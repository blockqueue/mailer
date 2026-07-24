import type { Context } from 'hono';

/** Client IP from x-forwarded-for, Cloudflare, or direct connection */
export function getClientIp(c: Context): string | null {
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // Multiple IPs: client, proxy1, … — take the original client
    return forwardedFor.split(',')[0].trim();
  }

  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  try {
    const rawRequest = c.req.raw;
    // Bun-specific property, not in types
    const requestWithRemote = rawRequest as { remoteAddress?: string };
    const remoteAddress = requestWithRemote.remoteAddress;
    if (remoteAddress && typeof remoteAddress === 'string') {
      return remoteAddress;
    }
  } catch {
    // Connection info may be unavailable
  }

  return null;
}
