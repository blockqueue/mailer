import type { SmsAccountConfig } from '../../types/config';
import type { SmsClient } from './base-client';
import { TermiiSmsClient } from './termii-client';

export function createSmsClient(accountConfig: SmsAccountConfig): SmsClient {
  return new TermiiSmsClient(accountConfig);
}
