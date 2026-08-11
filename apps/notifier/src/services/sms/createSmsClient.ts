import type { SmsAccountConfig } from '../../types/config';
import type { SmsClient } from './base-client';
import { TermiiSmsClient } from './termii-client';

export function createSmsClient(accountConfig: SmsAccountConfig): SmsClient {
  const type = (accountConfig as { type: string }).type;
  if (type !== 'termii') {
    throw new Error(`Unknown SMS client type: ${type}`);
  }
  return new TermiiSmsClient(accountConfig);
}
