import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import type { SendRequest } from '../types/request';

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * Request validation middleware
 * Validates request size, content type, parses body, and stores it in context
 * This makes the parsed body available for all downstream middleware and handlers
 */
export function requestValidationMiddleware(config: GlobalConfig) {
  const maxBodySize =
    config.requestValidation?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  return async (c: Context, next: Next) => {
    // Content-Type validation for POST requests
    if (c.req.method === 'POST') {
      const contentType = c.req.header('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return c.json({ error: 'Content-Type must be application/json' }, 400);
      }

      // Clone request to read body without consuming the original stream
      // This allows HMAC auth to also read the raw body if needed
      try {
        const clonedRequest = c.req.raw.clone();
        const rawBody = await clonedRequest.text();

        // Validate body size (actual size, not just header)
        if (rawBody.length > maxBodySize) {
          return c.json({ error: 'Payload too large' }, 413);
        }

        // Parse JSON and store both raw and parsed in context
        // This makes the body available for all downstream middleware
        try {
          const parsedBody = JSON.parse(rawBody) as SendRequest;
          // Store raw body for HMAC signature verification
          c.set('rawBody', rawBody);
          // Store parsed body for route handlers and audit logging
          c.set('parsedBody', parsedBody);
        } catch {
          return c.json({ error: 'Invalid JSON in request body' }, 400);
        }
      } catch {
        // If we can't read the body, return error
        return c.json({ error: 'Failed to read request body' }, 400);
      }
    } else {
      // For non-POST requests, check content-length header if present
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
