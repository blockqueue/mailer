import type { AccountConfig } from '../../types/config';

/**
 * Email sending options
 */
export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Attachment[];
  [key: string]: unknown; // Allow additional options
}

/**
 * Email attachment
 */
export interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  [key: string]: unknown;
}

/**
 * Result of sending an email
 */
export interface SendResult {
  messageId: string;
  success: boolean;
}

/**
 * Base class for email clients
 * All email client implementations must extend this class
 */
export abstract class EmailClient<T extends AccountConfig = AccountConfig> {
  protected config: T;

  constructor(config: T) {
    this.config = config;
  }

  /**
   * Validate that all required credentials are present in the config
   * This is a static validation that should be called during config loading
   * Should throw an error if required credentials are missing
   * @param _config The account configuration to validate
   */
  static validateCredentials(_config: AccountConfig): void {
    // Default implementation does nothing
    // Override in subclasses to validate specific requirements
  }

  /**
   * Send an email
   * @param options Email sending options
   * @returns Result with messageId and success status
   */
  abstract send(options: EmailOptions): Promise<SendResult>;

  /**
   * Close any open connections (optional, for clients that maintain connections)
   */
  async close(): Promise<void> {
    // Default implementation does nothing
    // Override in subclasses if needed
  }
}
