import type { EmailAccountConfig } from '../../types/config';
import { SesEmailClient } from './ses-client';
import { ZeptomailEmailClient } from './zeptomail-client';

export function createEmailClient(
  accountConfig: EmailAccountConfig,
): SesEmailClient | ZeptomailEmailClient {
  switch (accountConfig.type) {
    case 'ses':
      return new SesEmailClient(accountConfig);

    case 'zeptomail':
      return new ZeptomailEmailClient(accountConfig);

    default: {
      throw new Error(
        `Unknown email client type: ${String(accountConfig satisfies never)}`,
      );
    }
  }
}
