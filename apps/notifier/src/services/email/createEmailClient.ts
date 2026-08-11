import type { EmailAccountConfig } from '../../types/config';
import type { EmailClient } from './base-client';
import { SesEmailClient } from './ses-client';
import { ZeptomailEmailClient } from './zeptomail-client';

export function createEmailClient(
  accountConfig: EmailAccountConfig,
): EmailClient {
  switch (accountConfig.type) {
    case 'ses':
      return new SesEmailClient(accountConfig);

    case 'zeptomail':
      return new ZeptomailEmailClient(accountConfig);

    default: {
      const _exhaustive: never = accountConfig;
      throw new Error(`Unknown email client type: ${String(_exhaustive)}`);
    }
  }
}
