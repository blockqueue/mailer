import type { SmsAccountConfig } from '../../types/config';

export interface SmsOptions {
  to: string | string[];
  body: string;
  from?: string;
  version?: 'v3' | 'v4';
  channel?: 'dnd' | 'generic';
  messageType?: 'plain' | 'unicode';
}

export interface SmsSendResult {
  messageId: string;
  success: boolean;
}

export abstract class SmsClient<T extends SmsAccountConfig = SmsAccountConfig> {
  protected config: T;

  constructor(config: T) {
    this.config = config;
  }

  abstract send(options: SmsOptions): Promise<SmsSendResult>;
}
