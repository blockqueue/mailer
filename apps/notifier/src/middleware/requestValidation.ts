import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import type { AppEnv } from '../types/hono';

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

class BodyTooLargeError extends Error {
  constructor() {
    super('Payload too large');
    this.name = 'BodyTooLargeError';
  }
}

async function readBodyWithByteLimit(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw error;
    }
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(
    'utf8',
  );
}

export function requestValidationMiddleware(config: GlobalConfig) {
  const maxBodySize =
    config.requestValidation?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  return async (c: Context<AppEnv>, next: Next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > maxBodySize) {
        return c.json({ success: false, message: 'Payload too large' }, 413);
      }
    }

    if (c.req.method === 'POST') {
      const contentType = c.req.header('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return c.json(
          { success: false, message: 'Content-Type must be application/json' },
          400,
        );
      }

      try {
        const clonedRequest = c.req.raw.clone();
        const rawBody = await readBodyWithByteLimit(clonedRequest, maxBodySize);

        try {
          const parsedBody = JSON.parse(rawBody) as unknown;
          if (
            parsedBody === null ||
            typeof parsedBody !== 'object' ||
            Array.isArray(parsedBody)
          ) {
            return c.json(
              {
                success: false,
                message: 'Request JSON body must be an object',
              },
              400,
            );
          }
          c.set('rawBody', rawBody);
          c.set('parsedBody', parsedBody as Record<string, unknown>);
        } catch {
          return c.json(
            { success: false, message: 'Invalid JSON in request body' },
            400,
          );
        }
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          return c.json({ success: false, message: 'Payload too large' }, 413);
        }
        return c.json(
          { success: false, message: 'Failed to read request body' },
          400,
        );
      }
    }

    await next();
  };
}
