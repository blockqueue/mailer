import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';

/**
 * Authentication middleware for API key validation
 */
export function authMiddleware(config: GlobalConfig) {
  return async (c: Context, next: Next) => {
    const headerName = config.auth.header.toLowerCase();
    const apiKey = c.req.header(headerName);

    if (!apiKey) {
      return c.json({ error: 'Missing API key' }, 401);
    }

    if (apiKey !== config.auth.value) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    await next();
  };
}
