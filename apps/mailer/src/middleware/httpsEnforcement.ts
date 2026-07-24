import type { Context, Next } from 'hono';

/** Require HTTPS except for localhost */
export function httpsEnforcementMiddleware() {
  return async (c: Context, next: Next) => {
    const protocol = c.req.header('x-forwarded-proto') ?? 'http';
    const host = c.req.header('host') ?? '';

    const isLocalhost =
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('[::1]');

    if (protocol !== 'https' && !isLocalhost) {
      return c.json({ error: 'HTTPS required' }, 403);
    }

    await next();
  };
}
