import type { EmailAccountConfig } from '../../types/config';

export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  bounceAddress?: string;
  attachments?: Attachment[];
  [key: string]: unknown;
}

export interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  [key: string]: unknown;
}

export interface SendResult {
  messageId: string;
  success: boolean;
}

export abstract class EmailClient<
  T extends EmailAccountConfig = EmailAccountConfig,
> {
  protected config: T;

  constructor(config: T) {
    this.config = config;
  }

  abstract send(options: EmailOptions): Promise<SendResult>;

  close(): Promise<void> {
    return Promise.resolve();
  }
}
