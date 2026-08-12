import type { EmailAccountConfig } from '../../types/config';

export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

export interface SendResult {
  messageId: string;
  success: boolean;
}

export abstract class EmailClient<
  TConfig extends EmailAccountConfig = EmailAccountConfig,
  TOptions extends EmailOptions = EmailOptions,
> {
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  abstract send(options: TOptions): Promise<SendResult>;

  close(): Promise<void> {
    return Promise.resolve();
  }
}
