import type { AccountConfig } from '../../types/config';
import type { SendRequest } from '../../types/request';
import type { TemplateConfig } from '../../types/template';
import { logger } from '../../utils/logger';
import { validateEmailAddresses } from '../../utils/validation/email';
import type { EmailClient, EmailOptions } from './base-client';

/**
 * Merge sendMail options with priority:
 * request sendMailOptions > template > account (fallback).
 * Only explicit non-empty values are used.
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
  return true;
}

function mergeSendMailOptions(
  requestSendMailOptions: SendRequest['sendMailOptions'],
  template: TemplateConfig,
  accountConfig: AccountConfig,
): SendMailOptions {
  const merged: SendMailOptions = {};

  for (const [key, value] of Object.entries(accountConfig)) {
    // Skip provider credential fields
    if (
      key === 'type' ||
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

  for (const [key, value] of Object.entries(template)) {
    // Skip template metadata fields that aren't sendMail options
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

  if (requestSendMailOptions) {
    for (const [key, value] of Object.entries(requestSendMailOptions)) {
      if (isValidValue(value)) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

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

export async function sendEmail(
  client: EmailClient,
  html: string,
  request: SendRequest,
  template: TemplateConfig,
  accountConfig: AccountConfig,
): Promise<{ messageId: string; success: boolean }> {
  const sendMailOptions = mergeSendMailOptions(
    request.sendMailOptions,
    template,
    accountConfig,
  );

  validateSendMailOptions(sendMailOptions);

  if (!sendMailOptions.from) {
    throw new Error('Missing required field: from');
  }
  if (!sendMailOptions.to) {
    throw new Error('Missing required field: to');
  }
  if (!sendMailOptions.subject) {
    throw new Error('Missing required field: subject');
  }

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
