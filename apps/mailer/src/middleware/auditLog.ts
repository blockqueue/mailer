import type { Context, Next } from 'hono';
import type { SendRequest } from '../types/request';
import { getClientIp } from '../utils/getClientIp';

interface AuditLogEntry {
  timestamp: string;
  ip: string | null;
  method: string;
  path: string;
  statusCode: number;
  requestSize?: number;
  responseTime: number;
  templateId?: string;
  accountId?: string;
}

/**
 * Extract metadata from parsed request body
 * Returns templateId and accountId for audit logging
 *
 * Note: parsedBody is set by request validation middleware for all POST requests.
 * For POST requests, missing parsedBody is treated as an error condition.
 * For non-POST requests (e.g., GET /health), parsedBody is not expected.
 */
function extractRequestMetadata(c: Context): {
  templateId?: string;
  accountId?: string;
} {
  const method = c.req.method;
  const path = c.req.path;

  // For non-POST requests, parsedBody is not expected
  if (method !== 'POST') {
    return {};
  }

  // Hono's context.get() doesn't support custom keys in its type system
  // We use a type assertion to access the custom 'parsedBody' variable
  // This is set by request validation middleware for POST requests
  const parsedBody = (c as unknown as { get: (key: string) => unknown }).get(
    'parsedBody',
  ) as SendRequest | undefined;

  // For POST requests, parsedBody should always be available
  // If it's missing, this indicates a critical bug in the middleware chain
  if (!parsedBody || typeof parsedBody !== 'object') {
    throw new Error(`Missing parsedBody for POST request to ${path}.`);
  }

  return {
    templateId:
      'templateId' in parsedBody && typeof parsedBody.templateId === 'string'
        ? parsedBody.templateId
        : undefined,
    accountId:
      'account' in parsedBody && typeof parsedBody.account === 'string'
        ? parsedBody.account
        : undefined,
  };
}

/**
 * Audit logging middleware
 * Logs all requests with metadata (PII-safe)
 */
export function auditLogMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const ip = getClientIp(c);
    const method = c.req.method;
    const path = c.req.path;
    const contentLength = c.req.header('content-length');
    const requestSize = contentLength ? parseInt(contentLength, 10) : undefined;

    await next();

    // Extract metadata from request if available (for /send endpoint)
    // parsedBody is set by request validation middleware, so it's available for all requests
    const { templateId, accountId } = extractRequestMetadata(c);

    const responseTime = Date.now() - startTime;
    const statusCode = c.res.status;

    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      ip,
      method,
      path,
      statusCode,
      requestSize,
      responseTime,
      templateId,
      accountId,
    };

    // Log all requests
    console.log(JSON.stringify(logEntry));

    // Special logging for important events
    if (statusCode === 401) {
      console.warn(
        JSON.stringify({
          ...logEntry,
          event: 'authentication_failed',
        }),
      );
    }

    if (statusCode === 403) {
      console.warn(
        JSON.stringify({
          ...logEntry,
          event: 'access_denied',
        }),
      );
    }

    if (statusCode === 429) {
      console.warn(
        JSON.stringify({
          ...logEntry,
          event: 'rate_limit_exceeded',
        }),
      );
    }

    if (requestSize && requestSize > 100 * 1024) {
      // Log large requests (>100KB)
      console.warn(
        JSON.stringify({
          ...logEntry,
          event: 'large_request',
          size: requestSize,
        }),
      );
    }

    if (responseTime > 1000) {
      // Log slow requests (>1 second)
      console.warn(
        JSON.stringify({
          ...logEntry,
          event: 'slow_request',
          responseTime,
        }),
      );
    }
  };
}
