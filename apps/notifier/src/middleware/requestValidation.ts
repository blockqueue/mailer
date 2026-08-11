import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

export function requestValidationMiddleware(config: GlobalConfig) {
  const maxBodySize =
    config.requestValidation?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  return async (c: Context, next: Next) => {
    if (c.req.method === 'POST') {
      const contentType = c.req.header('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return c.json({ error: 'Content-Type must be application/json' }, 400);
      }

      try {
        const clonedRequest = c.req.raw.clone();
        const rawBody = await clonedRequest.text();

        if (rawBody.length > maxBodySize) {
          return c.json({ error: 'Payload too large' }, 413);
        }

        try {
          const parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
          c.set('rawBody', rawBody);
          c.set('parsedBody', parsedBody);
        } catch {
          return c.json({ error: 'Invalid JSON in request body' }, 400);
        }
      } catch {
        return c.json({ error: 'Failed to read request body' }, 400);
      }
    } else {
      const contentLength = c.req.header('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size) && size > maxBodySize) {
          return c.json({ error: 'Payload too large' }, 413);
        }
      }
    }

    await next();
  };
}
