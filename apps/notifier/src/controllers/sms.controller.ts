import type { Context } from 'hono';
import { createSmsClient } from '../services/sms/createSmsClient';
import { sendSms } from '../services/sms/send';
import type { GlobalConfig } from '../types/config';
import type { SendResponse, SendSmsRequest } from '../types/request';
import { logger } from '../utils/logger';

export async function sendSmsController(
  c: Context,
  body: SendSmsRequest,
  config: GlobalConfig,
): Promise<Response> {
  try {
    if (!config.sms?.accounts) {
      return c.json(
        { success: false, message: 'SMS channel is not configured' },
        503,
      );
    }

    if (
      !body.to ||
      (Array.isArray(body.to) && body.to.length === 0) ||
      (typeof body.to === 'string' && !body.to.trim())
    ) {
      return c.json(
        { success: false, message: 'Missing required field: to' },
        400,
      );
    }

    if (typeof body.body !== 'string' || !body.body.trim()) {
      return c.json(
        { success: false, message: 'Missing required field: body' },
        400,
      );
    }

    if (body.sendOptions?.version) {
      const version = body.sendOptions.version as string;
      if (version !== 'v3' && version !== 'v4') {
        return c.json(
          {
            success: false,
            message: 'sendOptions.version must be "v3" or "v4"',
          },
          400,
        );
      }
    }

    const accountId = body.account ?? config.sms.defaults?.account;
    if (!accountId) {
      return c.json(
        {
          success: false,
          message: 'No account specified and no default SMS account configured',
        },
        400,
      );
    }

    const accountConfig = config.sms.accounts[accountId];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!accountConfig) {
      return c.json(
        { success: false, message: `SMS account not found: ${accountId}` },
        400,
      );
    }

    const client = createSmsClient(accountConfig);
    const result = await sendSms(client, body, accountConfig);

    const response: SendResponse = {
      success: true,
      messageId: result.messageId,
    };

    return c.json(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        error: errorMessage,
        ...(errorStack && { stack: errorStack }),
      },
      'Error processing SMS send request',
    );
    return c.json(
      {
        success: false,
        message: errorMessage,
      },
      500,
    );
  }
}
