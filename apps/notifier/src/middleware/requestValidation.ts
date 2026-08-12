import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import type { AppEnv } from '../types/hono';

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

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
        const rawBody = await clonedRequest.text();

        if (rawBody.length > maxBodySize) {
          return c.json({ success: false, message: 'Payload too large' }, 413);
        }

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
      } catch {
        return c.json(
          { success: false, message: 'Failed to read request body' },
          400,
        );
      }
    }

    await next();
  };
}
