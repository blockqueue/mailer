import type { SmsAccountConfig } from '../../types/config';
import type { SendSmsRequest } from '../../types/request';
import { logger } from '../../utils/logger';
import type { SmsClient } from './base-client';

export async function sendSms(
  client: SmsClient,
  request: SendSmsRequest,
  accountConfig: SmsAccountConfig,
): Promise<{ messageId: string; success: boolean }> {
  try {
    return await client.send({
      to: request.to,
      body: request.body,
      from: request.sendOptions?.from ?? accountConfig.from,
      version: request.sendOptions?.version,
      channel: request.sendOptions?.channel,
      messageType: request.sendOptions?.messageType,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        error: errorMessage,
        ...(errorStack && { stack: errorStack }),
      },
      'Failed to send SMS',
    );
    throw new Error(`Failed to send SMS: ${errorMessage}`);
  }
}
