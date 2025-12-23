import type { Context, Next } from 'hono';
import ipaddr from 'ipaddr.js';
import type { GlobalConfig } from '../types/config';
import { getClientIp } from '../utils/getClientIp';

/**
 * Check if an IP address matches a CIDR block or exact IP
 * Uses ipaddr.js library for robust IPv4/IPv6 CIDR matching
 */
function ipMatches(ip: string, pattern: string): boolean {
  try {
    // Exact match
    if (ip === pattern) {
      return true;
    }

    // CIDR notation (e.g., 192.168.1.0/24 or 2001:db8::/32)
    if (pattern.includes('/')) {
      // Use parseCIDR for CIDR patterns - handles validation and parsing
      const [networkAddr, prefixLength] = ipaddr.parseCIDR(pattern);
      const ipAddr = ipaddr.process(ip);

      // Check if both are same type (IPv4 or IPv6)
      if (ipAddr.kind() !== networkAddr.kind()) {
        return false;
      }

      // Use match method for CIDR checking
      return ipAddr.match(networkAddr, prefixLength);
    }

    // Not a CIDR pattern and not an exact match
    return false;
  } catch {
    // Invalid IP address or pattern format
    return false;
  }
}

/**
 * IP allowlisting middleware (optional)
 * Checks if request IP is in the allowlist
 */
export function ipAllowlistMiddleware(config: GlobalConfig) {
  return async (c: Context, next: Next) => {
    // Skip if IP allowlisting is not enabled
    if (!config.ipAllowlist?.enabled) {
      await next();
      return;
    }

    const allowedIps = config.ipAllowlist.allowedIps ?? [];
    if (allowedIps.length === 0) {
      await next();
      return;
    }

    const clientIp = getClientIp(c);
    if (!clientIp) {
      return c.json({ error: 'Could not determine client IP' }, 403);
    }

    // Check if IP matches any allowed pattern
    const isAllowed = allowedIps.some((pattern) =>
      ipMatches(clientIp, pattern),
    );

    if (!isAllowed) {
      return c.json({ error: 'IP address not allowed' }, 403);
    }

    await next();
  };
}
