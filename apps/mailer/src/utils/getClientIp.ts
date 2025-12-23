import type { Context } from 'hono';

/**
 * Extract client IP from request headers
 * Checks common proxy headers in order:
 * 1. x-forwarded-for (takes first IP if multiple)
 * 2. cf-connecting-ip (Cloudflare)
 *
 * Returns null if IP cannot be determined
 */
export function getClientIp(c: Context): string | null {
  // Check common proxy headers
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to direct connection IP (if available)
  // Note: In Hono, we don't have direct access to connection IP
  // This would need to be set by the server/adapter
  return null;
}
