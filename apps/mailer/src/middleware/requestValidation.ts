import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import type { SendRequest } from '../types/request';

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024; // 1MB

/** Validates size/content-type, parses JSON, stores rawBody + parsedBody on context */
export function requestValidationMiddleware(config: GlobalConfig) {
  const maxBodySize =
    config.requestValidation?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  return async (c: Context, next: Next) => {
    if (c.req.method === 'POST') {
      const contentType = c.req.header('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return c.json({ error: 'Content-Type must be application/json' }, 400);
      }

      // Clone so we can read the body without consuming the stream (HMAC needs raw text)
      try {
        const clonedRequest = c.req.raw.clone();
        const rawBody = await clonedRequest.text();

        if (rawBody.length > maxBodySize) {
          return c.json({ error: 'Payload too large' }, 413);
        }

        try {
          const parsedBody = JSON.parse(rawBody) as SendRequest;
          // rawBody kept for HMAC; parsedBody for handlers / audit
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
