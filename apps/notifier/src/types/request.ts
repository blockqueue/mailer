import type {
  TermiiApiVersion,
  TermiiChannel,
  TermiiMessageType,
} from './config';

export interface SendMailOptions {
  from?: string;
  to?: string | string[];
  subject?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: unknown[];
}

export interface ZeptomailSendMailOptions extends SendMailOptions {
  fromName?: string;
  bounceAddress?: string;
}

export interface SendEmailRequest {
  templateId: string;
  account?: string;
  payload: unknown;
  sendMailOptions?: ZeptomailSendMailOptions;
}

export interface TermiiSendOptions {
  version?: TermiiApiVersion;
  from?: string;
  channel?: TermiiChannel;
  messageType?: TermiiMessageType;
}

export interface SendSmsRequest {
  to: string | string[];
  body: string;
  account?: string;
  sendOptions?: TermiiSendOptions;
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
