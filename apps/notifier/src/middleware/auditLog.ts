import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/hono';
import { logger } from '../utils/logger';

function extractRequestMetadata(c: Context<AppEnv>): {
  templateId?: string;
  accountId?: string;
} {
  const method = c.req.method;

  if (method !== 'POST') {
    return {};
  }

  const parsedBody = c.get('parsedBody');

  if (
    !parsedBody ||
    typeof parsedBody !== 'object' ||
    Array.isArray(parsedBody)
  ) {
    return {};
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
  return async (c: Context<AppEnv>, next: Next) => {
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
        'Forbidden',
      );
    }

    if (statusCode >= 500) {
      logger.error(
        {
          method,
          path,
          statusCode,
          templateId,
          accountId,
        },
        'Server error',
      );
    }

    if (requestSize && requestSize > 512 * 1024) {
      logger.warn(
        {
          method,
          path,
          requestSize,
          templateId,
          accountId,
        },
        'Large request',
      );
    }

    if (responseTime > 5000) {
      logger.warn(
        {
          method,
          path,
          responseTime,
          templateId,
          accountId,
        },
        'Slow request',
      );
    }
  };
}
