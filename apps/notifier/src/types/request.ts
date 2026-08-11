export interface SendEmailRequest {
  templateId: string;
  account?: string;
  payload: unknown;
  sendMailOptions?: {
    from?: string;
    to?: string | string[];
    subject?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: unknown[];
    [key: string]: unknown;
  };
}

export interface SendSmsRequest {
  to: string | string[];
  body: string;
  account?: string;
  sendOptions?: {
    version?: 'v3' | 'v4';
    from?: string;
    channel?: 'dnd' | 'generic';
    messageType?: 'plain' | 'unicode';
  };
}

export type SendResponse =
  | {
      success: true;
      messageId: string;
    }
  | {
      success: false;
      message: string;
      details?: unknown;
    };
