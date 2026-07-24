import type { AccountConfig } from '../../types/config';

/** Email sending options */
export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Attachment[];
  [key: string]: unknown;
}

/** Email attachment */
export interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  [key: string]: unknown;
}

/** Result of sending an email */
export interface SendResult {
  messageId: string;
  success: boolean;
}

/** Base class for email client implementations */
export abstract class EmailClient<T extends AccountConfig = AccountConfig> {
  protected config: T;

  constructor(config: T) {
    this.config = config;
  }

  static validateCredentials(_config: AccountConfig): void {
    // Override in subclasses
  }

  abstract send(options: EmailOptions): Promise<SendResult>;

  async close(): Promise<void> {
    // Override if the client maintains connections
  }
}
