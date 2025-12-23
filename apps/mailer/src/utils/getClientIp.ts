import type { Context } from 'hono';

/**
 * Extract client IP from request headers or direct connection
 *
 * IP detection works in the following scenarios:
 * 1. Behind reverse proxy (nginx, load balancer, etc.): IP from x-forwarded-for header
 * 2. Behind Cloudflare: IP from cf-connecting-ip header
 * 3. Direct connection (no proxy): Attempts to get IP from connection
 * 4. Localhost/testing (Postman, curl): Returns null (no IP available)
 *
 * In production with a reverse proxy, the proxy MUST set x-forwarded-for header
 * for IP detection to work. Most production setups include this.
 */
export function getClientIp(c: Context): string | null {
  // 1. Check x-forwarded-for header (set by reverse proxies)
  // This is the most common case in production
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2)
    // Take the first one (original client IP)
    return forwardedFor.split(',')[0].trim();
  }

  // 2. Check cf-connecting-ip header (Cloudflare)
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // 3. Try to get direct connection IP
  // This works for direct connections without a proxy
  try {
    // In Bun, the request might have connection info
    const rawRequest = c.req.raw;
    // Bun-specific property, not in types - safely access with type assertion
    const requestWithRemote = rawRequest as { remoteAddress?: string };
    const remoteAddress = requestWithRemote.remoteAddress;
    if (remoteAddress && typeof remoteAddress === 'string') {
      return remoteAddress;
    }
  } catch {
    // Ignore errors if connection info not available
  }

  // 4. No IP available (localhost, testing, or missing proxy headers)
  return null;
}
