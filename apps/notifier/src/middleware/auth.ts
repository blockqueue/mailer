import crypto from 'crypto';
import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import type { AppEnv } from '../types/hono';
import { verifySignature } from '../utils/verifySignature';

function secureCompareApiKey(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function authMiddleware(config: GlobalConfig) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (config.auth.type === 'apiKey') {
      const headerName = (
        config.auth.header ?? 'x-notifier-api-key'
      ).toLowerCase();
      const apiKey = c.req.header(headerName);

      if (!apiKey) {
        return c.json({ success: false, message: 'Missing API key' }, 401);
      }

      if (!secureCompareApiKey(apiKey, config.auth.value)) {
        return c.json({ success: false, message: 'Invalid API key' }, 401);
      }
    } else {
      const authType = (config.auth as { type: string }).type;
      if (authType !== 'hmac') {
        return c.json(
          {
            success: false,
            message: `Unsupported auth type: ${authType}`,
          },
          500,
        );
      }

      const headerName = (
        config.auth.header ?? 'x-notifier-signature'
      ).toLowerCase();
      const signature = c.req.header(headerName);

      if (!signature) {
        return c.json({ success: false, message: 'Missing signature' }, 401);
      }

      const rawBody = c.get('rawBody');

      if (!rawBody) {
        return c.json(
          { success: false, message: 'Request body not available' },
          500,
        );
      }

      const isValid = verifySignature({
        payload: rawBody,
        signature,
        secret: config.auth.secret,
        tolerance: config.auth.tolerance,
      });

      if (!isValid) {
        return c.json({ success: false, message: 'Invalid signature' }, 401);
      }
    }

    await next();
  };
}
