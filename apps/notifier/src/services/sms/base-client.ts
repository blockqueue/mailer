import type { SmsAccountConfig } from '../../types/config';

export interface SmsOptions {
  to: string | string[];
  body: string;
  from?: string;
}

export interface SmsSendResult {
  messageId: string;
  success: boolean;
}

export abstract class SmsClient<
  TConfig extends SmsAccountConfig = SmsAccountConfig,
  TOptions extends SmsOptions = SmsOptions,
> {
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  abstract send(options: TOptions): Promise<SmsSendResult>;
}
