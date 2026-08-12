import type { Context } from 'hono';
import { createSmsClient } from '../services/sms/createSmsClient';
import { sendSms } from '../services/sms/send';
import type { GlobalConfig } from '../types/config';
import type { SendResponse, SendSmsRequest } from '../types/request';
import { validateSmsRequest } from '../utils/validation/sms';
import { handleChannelError } from './handle-channel-error';

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

    validateSmsRequest(body, accountConfig);

    const client = createSmsClient(accountConfig);
    const result = await sendSms(client, body, accountConfig);

    const response: SendResponse = {
      success: true,
      messageId: result.messageId,
    };

    return c.json(response);
  } catch (error: unknown) {
    return handleChannelError(c, error, {
      providerLabel: 'SMS',
      logMessage: 'Error processing SMS send request',
    });
  }
}
