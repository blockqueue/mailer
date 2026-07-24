import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import { verifySignature } from '../utils/verifySignature';

/** API key or HMAC authentication */
export function authMiddleware(config: GlobalConfig) {
  return async (c: Context, next: Next) => {
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
      // Defensive runtime check for discriminated union (YAML may be wrong)
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

      // HMAC needs the raw body (set by request validation) for signature verify
      const headerName = (
        config.auth.header ?? 'x-mailer-signature'
      ).toLowerCase();
      const signature = c.req.header(headerName);

      if (!signature) {
        return c.json({ error: 'Missing signature' }, 401);
      }

      const rawBody = (c as unknown as { get: (key: string) => unknown }).get(
        'rawBody',
      ) as string | undefined;

      if (!rawBody) {
        return c.json({ error: 'Request body not available' }, 500);
      }

      const isValid = verifySignature({
        payload: rawBody,
        signature,
        secret: config.auth.secret,
        tolerance: config.auth.tolerance,
      });

      if (!isValid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
    }

    await next();
  };
}
