import type { Context, Next } from 'hono';
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

  const parsedBody = (c as unknown as { get: (key: string) => unknown }).get(
    'parsedBody',
  ) as Record<string, unknown> | undefined;

  if (!parsedBody || typeof parsedBody !== 'object') {
    throw new Error(`Missing parsedBody for POST request to ${path}.`);
  }

  return {
    templateId:
      typeof parsedBody.templateId === 'string'
        ? parsedBody.templateId
        : undefined,
    accountId:
      typeof parsedBody.account === 'string' ? parsedBody.account : undefined,
  };
}

export function auditLogMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
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
          method,
          path,
          requestSize,
        },
        'Large request detected',
      );
    }

    const slowRequestThreshold =
      path === '/email/send' || path === '/sms/send' ? 10000 : 1000;

    if (responseTime > slowRequestThreshold) {
      logger.warn(
        {
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
