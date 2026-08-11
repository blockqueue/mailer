import type { SmsAccountConfig } from '../../types/config';
import type { SendSmsRequest } from '../../types/request';
import type { SmsClient } from './base-client';

export async function sendSms(
  client: SmsClient,
  request: SendSmsRequest,
  accountConfig: SmsAccountConfig,
): Promise<{ messageId: string; success: boolean }> {
  return client.send({
    to: request.to,
    body: request.body,
    from: request.sendOptions?.from ?? accountConfig.from,
    version: request.sendOptions?.version,
    channel: request.sendOptions?.channel,
    messageType: request.sendOptions?.messageType,
  });
}
