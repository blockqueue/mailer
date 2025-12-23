import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import { verifySignature } from '../utils/verifySignature';

/**
 * Authentication middleware for API key or HMAC validation
 */
export function authMiddleware(config: GlobalConfig) {
  return async (c: Context, next: Next) => {
    // Type guard for discriminated union
    if (config.auth.type === 'apiKey') {
      const headerName = (
        config.auth.header ?? 'x-mailer-api-key'
      ).toLowerCase();
      const apiKey = c.req.header(headerName);

      if (!apiKey) {
        return c.json({ error: 'Missing API key' }, 401);
      }

      if (apiKey !== config.auth.value) {
        return c.json({ error: 'Invalid API key' }, 401);
      }
    } else {
      // TypeScript narrows this to HmacAuthConfig, but we validate defensively at runtime
      // This handles cases where config validation might have failed or type was corrupted
      const authType = (config.auth as { type: string }).type;
      if (authType !== 'hmac') {
        return c.json(
          {
            error: 'Invalid authentication configuration',
            message: `Unsupported auth type: ${authType}`,
          },
          500,
        );
      }

      // For HMAC, we need the raw request body
      const headerName = (
        config.auth.header ?? 'x-mailer-signature'
      ).toLowerCase();
      const signature = c.req.header(headerName);

      if (!signature) {
        return c.json({ error: 'Missing signature' }, 401);
      }

      // Get raw body from context (set by request validation middleware)
      // Request validation middleware always sets rawBody for POST requests
      const rawBody = (c as unknown as { get: (key: string) => unknown }).get(
        'rawBody',
      ) as string | undefined;

      if (!rawBody) {
        // This shouldn't happen for POST requests, but handle gracefully
        return c.json({ error: 'Request body not available' }, 500);
      }

      // Verify signature using raw body from context
      const isValid = verifySignature({
        payload: rawBody,
        signature,
        secret: config.auth.secret,
        tolerance: config.auth.tolerance,
      });

      if (!isValid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
      // parsedBody is already set by request validation middleware
    }

    await next();
  };
}
