/**
 * Request body for POST /send endpoint
 */
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
    [key: string]: unknown; // Allow any nodemailer sendMail options
  };
}

/**
 * Response from POST /send endpoint
 */
export interface SendResponse {
  messageId: string;
  success: boolean;
}
