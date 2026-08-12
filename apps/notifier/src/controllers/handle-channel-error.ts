import type { Context } from 'hono';
import { getErrorLogFields } from '../utils/errors/error-details';
import { ChannelRequestError } from '../utils/errors/request-error';
import { logger } from '../utils/logger';

interface HandleChannelErrorOptions {
  providerLabel: string;
  logMessage: string;
}

export function handleChannelError(
  c: Context,
  error: unknown,
  options: HandleChannelErrorOptions,
): Response {
  if (error instanceof ChannelRequestError) {
    if (error.status === 502) {
      logger.error(
        { error: error.message },
        `${options.providerLabel} provider error`,
      );
      return c.json(
        {
          success: false,
          message: `${options.providerLabel} provider error`,
        },
        502,
      );
    }
    return c.json({ success: false, message: error.message }, error.status);
  }

  logger.error(getErrorLogFields(error), options.logMessage);
  return c.json({ success: false, message: 'Internal server error' }, 500);
}
