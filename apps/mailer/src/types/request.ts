/** Request body for POST /send */
export interface SendRequest {
  templateId: string;
  account?: string;
  payload: Record<string, unknown>;
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

/** Response from POST /send (consumer-compatible shape) */
export type SendResponse =
  | {
      success: true;
      messageId: string;
    }
  | {
      success: false;
      message: string;
      /** Optional extra context (e.g. validation errors) */
      details?: unknown;
    };
