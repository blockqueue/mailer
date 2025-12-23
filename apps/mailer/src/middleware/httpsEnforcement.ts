import type { Context, Next } from 'hono';

/**
 * HTTPS enforcement middleware
 * Ensures requests are made over HTTPS (unless localhost)
 */
export function httpsEnforcementMiddleware() {
  return async (c: Context, next: Next) => {
    // Check protocol from x-forwarded-proto header or connection
    const protocol = c.req.header('x-forwarded-proto') ?? 'http';
    const host = c.req.header('host') ?? '';

    // Allow localhost for development
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
