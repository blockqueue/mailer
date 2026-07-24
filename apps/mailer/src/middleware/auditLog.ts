import type { Context, Next } from 'hono';
import type { SendRequest } from '../types/request';
import { getClientIp } from '../utils/getClientIp';
import { logger } from '../utils/logger';

function extractRequestMetadata(c: Context): {
  templateId?: string;
  accountId?: string;
} {
  const method = c.req.method;
  const path = c.req.path;

  if (method !== 'POST') {
    return {};
  }

  // Hono's context.get() doesn't type custom keys; assertion for 'parsedBody'
  const parsedBody = (c as unknown as { get: (key: string) => unknown }).get(
    'parsedBody',
  ) as SendRequest | undefined;

  // Missing parsedBody on POST means the middleware chain is broken
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

/** PII-safe request audit logging */
export function auditLogMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const ip = getClientIp(c);
    const method = c.req.method;
    const path = c.req.path;
    const contentLength = c.req.header('content-length');
    const requestSize = contentLength ? parseInt(contentLength, 10) : undefined;

    await next();

    const { templateId, accountId } = extractRequestMetadata(c);

    const responseTime = Date.now() - startTime;
    const statusCode = c.res.status;

    logger.info(
      {
        ip,
        method,
        path,
        statusCode,
        requestSize,
        responseTime,
        templateId,
        accountId,
      },
      'Request processed',
    );

    if (statusCode === 401) {
      logger.warn(
        {
          ip,
          method,
          path,
          statusCode,
          templateId,
          accountId,
        },
        'Authentication failed',
      );
    }

    if (statusCode === 403) {
      logger.warn(
        {
          ip,
          method,
          path,
          statusCode,
          templateId,
          accountId,
        },
        'Access denied',
      );
    }

    if (requestSize && requestSize > 100 * 1024) {
      logger.warn(
        {
          ip,
          method,
          path,
          requestSize,
        },
        'Large request detected',
      );
    }

    // /send often waits on external SMTP; other routes should be fast
    const slowRequestThreshold = path === '/send' ? 10000 : 1000;

    if (responseTime > slowRequestThreshold) {
      logger.warn(
        {
          ip,
          method,
          path,
          responseTime,
          threshold: slowRequestThreshold,
        },
        'Slow request detected',
      );
    }
  };
}
