import type { Transporter } from 'nodemailer';
import type { AccountConfig } from '../../types/config';
import type { SendRequest } from '../../types/request';
import type { TemplateConfig } from '../../types/template';
import { validateEmailAddresses } from '../../utils/validation/email';

/**
 * Merge sendMail options from multiple sources with priority:
 * 1. Request body sendMailOptions (highest priority - can override everything)
 * 2. Account-level 'from' field (lowest priority, fallback)
 */
interface SendMailOptions {
  from?: string;
  to?: string | string[];
  subject?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  html?: string;
  attachments?: unknown[];
  [key: string]: unknown;
}

function mergeSendMailOptions(
  requestSendMailOptions: SendRequest['sendMailOptions'],
  accountConfig: AccountConfig,
): SendMailOptions {
  const merged: SendMailOptions = {};

  // Start with account-level 'from' field (if present, e.g., for SMTP accounts)
  // This is the fallback for 'from' if not provided in request
  if ('from' in accountConfig && typeof accountConfig.from === 'string') {
    merged.from = accountConfig.from;
  }

  // Apply request sendMailOptions (highest priority - can override 'from' from config)
  if (requestSendMailOptions) {
    Object.assign(merged, requestSendMailOptions);
  }

  return merged;
}

/**
 * Validate all email fields in sendMail options
 */
function validateSendMailOptions(options: SendMailOptions): void {
  const validationResults: { field: string; invalid: string[] }[] = [
    {
      field: 'from',
      invalid: validateEmailAddresses(options.from, 'from', true),
    },
    {
      field: 'to',
      invalid: validateEmailAddresses(options.to, 'to', true),
    },
    {
      field: 'cc',
      invalid: validateEmailAddresses(options.cc, 'cc'),
    },
    {
      field: 'bcc',
      invalid: validateEmailAddresses(options.bcc, 'bcc'),
    },
    {
      field: 'replyTo',
      invalid: validateEmailAddresses(options.replyTo, 'replyTo'),
    },
  ];

  const errors = validationResults
    .filter((result) => result.invalid.length > 0)
    .map((result) => {
      const fieldLabel =
        result.field === 'from' || result.field === 'replyTo'
          ? 'address'
          : 'addresses';
      return `Invalid '${result.field}' ${fieldLabel}: ${result.invalid.join(', ')}`;
    });

  if (errors.length > 0) {
    throw new Error(`Email validation failed: ${errors.join('; ')}`);
  }
}

/**
 * Send an email using nodemailer transport
 */
export async function sendEmail(
  transport: Transporter,
  html: string,
  request: SendRequest,
  template: TemplateConfig,
  accountConfig: AccountConfig,
): Promise<{ messageId: string; success: boolean }> {
  // Merge sendMail options from all sources
  // Priority: request.sendMailOptions > account.from (fallback)
  const sendMailOptions = mergeSendMailOptions(
    request.sendMailOptions,
    accountConfig,
  );

  // Validate all email addresses
  validateSendMailOptions(sendMailOptions);

  // Set HTML body
  sendMailOptions.html = html;
  console.log('==sendMailOptions==', sendMailOptions);

  // Send the email
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const info = await transport.sendMail(
      sendMailOptions as Parameters<Transporter['sendMail']>[0],
    );
    console.log('==info==', info);

    const messageId = (info as { messageId?: string }).messageId ?? '';
    return {
      messageId,
      success: true,
    };
  } catch (error: unknown) {
    console.error('Failed to send email:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
}
