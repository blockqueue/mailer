import type { Context, Next } from 'hono';
import type { GlobalConfig } from '../types/config';
import { getClientIp } from '../utils/getClientIp';

interface RequestRecord {
  requests: number[]; // Timestamps in milliseconds
  hourlyRequests: number[]; // Timestamps in milliseconds
}

// In-memory storage for rate limiting
const rateLimitStore = new Map<string, RequestRecord>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

/**
 * Clean up old entries from rate limit store
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  for (const [key, record] of rateLimitStore.entries()) {
    // Remove timestamps older than 1 hour
    record.requests = record.requests.filter((ts) => ts > now - 60000);
    record.hourlyRequests = record.hourlyRequests.filter(
      (ts) => ts > oneHourAgo,
    );

    // Remove entry if both arrays are empty
    if (record.requests.length === 0 && record.hourlyRequests.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate limiting middleware (optional)
 * Tracks requests by IP address using sliding window algorithm
 */
export function rateLimitMiddleware(config: GlobalConfig) {
  return async (c: Context, next: Next) => {
    // Skip if rate limiting is not enabled
    if (!config.rateLimit?.enabled) {
      await next();
      return;
    }

    const rateLimitConfig = config.rateLimit;

    // Perform cleanup periodically
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
      cleanupOldEntries();
      lastCleanup = now;
    }

    // Get client IP
    const clientIp = getClientIp(c);
    if (!clientIp) {
      // If we can't determine IP, we cannot rate limit, so block the request
      return c.json({ error: 'Could not determine client IP' }, 403);
    }

    // Get or create request record for this IP
    let record = rateLimitStore.get(clientIp);
    if (!record) {
      record = { requests: [], hourlyRequests: [] };
      rateLimitStore.set(clientIp, record);
    }

    const currentTime = Date.now();

    // Check per-minute limit
    if (
      rateLimitConfig.maxRequests !== undefined &&
      rateLimitConfig.windowMinutes !== undefined
    ) {
      const windowMs = rateLimitConfig.windowMinutes * 60 * 1000;
      const windowStart = currentTime - windowMs;

      // Remove old timestamps outside the window
      record.requests = record.requests.filter((ts) => ts > windowStart);

      // Check if limit exceeded
      if (record.requests.length >= rateLimitConfig.maxRequests) {
        const retryAfter = Math.ceil(
          (record.requests[0] + windowMs - currentTime) / 1000,
        );
        c.header('Retry-After', String(retryAfter));
        return c.json(
          {
            error: 'Rate limit exceeded',
            message: `Maximum ${String(rateLimitConfig.maxRequests)} requests per ${String(rateLimitConfig.windowMinutes)} minute(s)`,
          },
          429,
        );
      }

      // Add current request timestamp
      record.requests.push(currentTime);
    }

    // Check per-hour limit
    if (
      rateLimitConfig.maxRequestsPerHour !== undefined &&
      rateLimitConfig.windowHours !== undefined
    ) {
      const windowMs = rateLimitConfig.windowHours * 60 * 60 * 1000;
      const windowStart = currentTime - windowMs;

      // Remove old timestamps outside the window
      record.hourlyRequests = record.hourlyRequests.filter(
        (ts) => ts > windowStart,
      );

      // Check if limit exceeded
      if (record.hourlyRequests.length >= rateLimitConfig.maxRequestsPerHour) {
        const retryAfter = Math.ceil(
          (record.hourlyRequests[0] + windowMs - currentTime) / 1000,
        );
        c.header('Retry-After', String(retryAfter));
        return c.json(
          {
            error: 'Rate limit exceeded',
            message: `Maximum ${String(rateLimitConfig.maxRequestsPerHour)} requests per ${String(rateLimitConfig.windowHours)} hour(s)`,
          },
          429,
        );
      }

      // Add current request timestamp
      record.hourlyRequests.push(currentTime);
    }

    await next();
  };
}
