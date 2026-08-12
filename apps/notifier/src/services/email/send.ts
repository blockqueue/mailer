import type {
  EmailAccountConfig,
  RequestValidationConfig,
} from '../../types/config';
import type { SendEmailRequest } from '../../types/request';
import type { TemplateConfig } from '../../types/template';
import {
  getErrorLogFields,
  getErrorMessage,
} from '../../utils/errors/error-details';
import { EmailRequestError } from '../../utils/errors/request-error';
import { logger } from '../../utils/logger';
import { validateAttachments } from '../../utils/validation/attachments';
import { validateEmailAddresses } from '../../utils/validation/email';
import type { EmailOptions } from './base-client';
import type { SesEmailClient } from './ses-client';
import type { ZeptomailEmailClient } from './zeptomail-client';

const COMMON_SEND_MAIL_KEYS = new Set([
  'from',
  'to',
  'subject',
  'cc',
  'bcc',
  'replyTo',
  'attachments',
]);

const ZEPTOMAIL_SEND_MAIL_KEYS = new Set(['fromName', 'bounceAddress']);

interface MergedSendMailOptions {
  from?: string;
  to?: string | string[];
  subject?: string;
  fromName?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  bounceAddress?: string;
  attachments?: unknown[];
}

function isValidMailFieldValue(key: string, value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (key === 'attachments') {
    return Array.isArray(value) && value.length > 0;
  }

  if (key === 'to' || key === 'cc' || key === 'bcc') {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return (
        value.length > 0 &&
        value.every(
          (item) => typeof item === 'string' && item.trim().length > 0,
        )
      );
    }
    return false;
  }

  return typeof value === 'string' && value.trim().length > 0;
}

function allowedKeysForAccount(accountConfig: EmailAccountConfig): Set<string> {
  if (accountConfig.type === 'zeptomail') {
    return new Set([...COMMON_SEND_MAIL_KEYS, ...ZEPTOMAIL_SEND_MAIL_KEYS]);
  }
  return COMMON_SEND_MAIL_KEYS;
}

function mergeSendMailOptions(
  requestSendMailOptions: SendEmailRequest['sendMailOptions'],
  template: TemplateConfig,
  accountConfig: EmailAccountConfig,
): MergedSendMailOptions {
  const allowedKeys = allowedKeysForAccount(accountConfig);
  const merged: MergedSendMailOptions = {};

  for (const [key, value] of Object.entries(accountConfig)) {
    if (!allowedKeys.has(key)) {
      continue;
    }
    if (isValidMailFieldValue(key, value)) {
      merged[key as keyof MergedSendMailOptions] = value as never;
    }
  }

  for (const [key, value] of Object.entries(template)) {
    if (!allowedKeys.has(key)) {
      continue;
    }
    if (isValidMailFieldValue(key, value)) {
      merged[key as keyof MergedSendMailOptions] = value as never;
    }
  }

  if (requestSendMailOptions) {
    for (const [key, value] of Object.entries(requestSendMailOptions)) {
      if (!allowedKeys.has(key)) {
        continue;
      }
      if (isValidMailFieldValue(key, value)) {
        merged[key as keyof MergedSendMailOptions] = value as never;
      }
    }
  }

  return merged;
}

function validateSendMailOptions(options: MergedSendMailOptions): void {
  try {
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
      {
        field: 'bounceAddress',
        invalid: validateEmailAddresses(options.bounceAddress, 'bounceAddress'),
      },
    ];

    const errors = validationResults
      .filter((result) => result.invalid.length > 0)
      .map((result) => {
        const fieldLabel =
          result.field === 'from' ||
          result.field === 'replyTo' ||
          result.field === 'bounceAddress'
            ? 'address'
            : 'addresses';
        return `Invalid '${result.field}' ${fieldLabel}: ${result.invalid.join(', ')}`;
      });

    if (errors.length > 0) {
      throw new EmailRequestError(
        `Email validation failed: ${errors.join('; ')}`,
        400,
      );
    }
  } catch (error: unknown) {
    if (error instanceof EmailRequestError) {
      throw error;
    }
    throw new EmailRequestError(getErrorMessage(error), 400);
  }
}

function toCommonEmailOptions(
  sendMailOptions: MergedSendMailOptions & {
    from: string;
    to: string | string[];
    subject: string;
  },
  html: string,
): EmailOptions {
  return {
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
}

export async function sendEmail(
  client: SesEmailClient | ZeptomailEmailClient,
  html: string,
  request: SendEmailRequest,
  template: TemplateConfig,
  accountConfig: EmailAccountConfig,
  requestValidation?: RequestValidationConfig,
): Promise<{ messageId: string; success: boolean }> {
  const sendMailOptions = mergeSendMailOptions(
    request.sendMailOptions,
    template,
    accountConfig,
  );

  validateSendMailOptions(sendMailOptions);
  validateAttachments(sendMailOptions.attachments, requestValidation);

  if (!sendMailOptions.from) {
    throw new EmailRequestError('Missing required field: from', 400);
  }
  if (!sendMailOptions.to) {
    throw new EmailRequestError('Missing required field: to', 400);
  }
  if (!sendMailOptions.subject) {
    throw new EmailRequestError('Missing required field: subject', 400);
  }

  const common = toCommonEmailOptions(
    {
      ...sendMailOptions,
      from: sendMailOptions.from,
      to: sendMailOptions.to,
      subject: sendMailOptions.subject,
    },
    html,
  );

  try {
    const result =
      accountConfig.type === 'zeptomail'
        ? await (client as ZeptomailEmailClient).send({
            ...common,
            ...(sendMailOptions.fromName && {
              fromName: sendMailOptions.fromName,
            }),
            ...(sendMailOptions.bounceAddress && {
              bounceAddress: sendMailOptions.bounceAddress,
            }),
          })
        : await (client as SesEmailClient).send(common);
    return {
      messageId: result.messageId,
      success: result.success,
    };
  } catch (error: unknown) {
    if (error instanceof EmailRequestError) {
      throw error;
    }
    logger.error(getErrorLogFields(error), 'Failed to send email');
    throw new EmailRequestError(
      `Failed to send email: ${getErrorMessage(error)}`,
      502,
    );
  }
}
