import type { AccountConfig } from '../../types/config';
import type { SendRequest } from '../../types/request';
import type { TemplateConfig } from '../../types/template';
import { logger } from '../../utils/logger';
import { validateEmailAddresses } from '../../utils/validation/email';
import type { EmailClient, EmailOptions } from './base-client';

/**
 * Merge sendMail options from multiple sources with priority:
 * 1. Request body sendMailOptions (highest priority - can override everything)
 * 2. Template-level options (middle priority - overrides account)
 * 3. Account-level options (lowest priority, fallback)
 *
 * For each property, only use it if it's explicitly provided and non-empty.
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

/**
 * Check if a value is a non-empty string or a non-empty array
 */
function isValidValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  // For other types (numbers, booleans, objects), consider them valid if they exist
  return true;
}

function mergeSendMailOptions(
  requestSendMailOptions: SendRequest['sendMailOptions'],
  template: TemplateConfig,
  accountConfig: AccountConfig,
): SendMailOptions {
  const merged: SendMailOptions = {};

  // Step 1: Start with account-level options (lowest priority)
  // Account config can have any sendMail options (from, to, subject, etc.)
  for (const [key, value] of Object.entries(accountConfig)) {
    // Skip account-specific fields that aren't sendMail options
    if (
      key === 'type' ||
      key === 'host' ||
      key === 'port' ||
      key === 'secure' ||
      key === 'auth' ||
      key === 'path' ||
      key === 'region' ||
      key === 'apiKey' ||
      key === 'accessKeyId' ||
      key === 'secretAccessKey' ||
      key === 'bounceAddress'
    ) {
      continue;
    }
    if (isValidValue(value)) {
      merged[key] = value;
    }
  }

  // Step 2: Apply template-level options (middle priority - overrides account)
  // Template can have any sendMail options
  for (const [key, value] of Object.entries(template)) {
    // Skip template-specific fields that aren't sendMail options
    if (
      key === 'id' ||
      key === 'renderer' ||
      key === 'account' ||
      key === 'schema' ||
      key === 'templatePath'
    ) {
      continue;
    }
    if (isValidValue(value)) {
      merged[key] = value;
    }
  }

  // Step 3: Apply request sendMailOptions (highest priority - overrides template and account)
  if (requestSendMailOptions) {
    for (const [key, value] of Object.entries(requestSendMailOptions)) {
      if (isValidValue(value)) {
        merged[key] = value;
      }
    }
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
 * Send an email using an email client
 */
export async function sendEmail(
  client: EmailClient,
  html: string,
  request: SendRequest,
  template: TemplateConfig,
  accountConfig: AccountConfig,
): Promise<{ messageId: string; success: boolean }> {
  // Merge sendMail options from all sources
  // Priority: request.sendMailOptions > template.from > account.from (fallback)
  const sendMailOptions = mergeSendMailOptions(
    request.sendMailOptions,
    template,
    accountConfig,
  );

  // Validate all email addresses
  validateSendMailOptions(sendMailOptions);

  // Ensure required fields are present
  if (!sendMailOptions.from) {
    throw new Error('Missing required field: from');
  }
  if (!sendMailOptions.to) {
    throw new Error('Missing required field: to');
  }
  if (!sendMailOptions.subject) {
    throw new Error('Missing required field: subject');
  }

  // Prepare email options
  const emailOptions: EmailOptions = {
    from: sendMailOptions.from,
    to: sendMailOptions.to,
    subject: sendMailOptions.subject,
    html,
    ...(sendMailOptions.cc && { cc: sendMailOptions.cc }),
    ...(sendMailOptions.bcc && { bcc: sendMailOptions.bcc }),
    ...(sendMailOptions.replyTo && { replyTo: sendMailOptions.replyTo }),
    ...(sendMailOptions.attachments && {
      attachments: sendMailOptions.attachments as EmailOptions['attachments'],
    }),
  };

  // Send the email
  try {
    const result = await client.send(emailOptions);
    return {
      messageId: result.messageId,
      success: result.success,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        error: errorMessage,
        ...(errorStack && { stack: errorStack }),
      },
      'Failed to send email',
    );
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
}
