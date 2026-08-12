import type { SmsAccountConfig } from '../../types/config';
import { SmsRequestError } from '../../utils/errors/request-error';
import { TermiiSmsClient } from './termii-client';

export function createSmsClient(
  accountConfig: SmsAccountConfig,
): TermiiSmsClient {
  const type = (accountConfig as { type: string }).type;
  if (type !== 'termii') {
    throw new SmsRequestError(`SMS account has unsupported type: ${type}`, 400);
  }
  return new TermiiSmsClient(accountConfig);
}
