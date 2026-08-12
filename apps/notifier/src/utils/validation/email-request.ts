import type { EmailAccountConfig } from '../../types/config';
import type { SendEmailRequest } from '../../types/request';
import { EmailRequestError } from '../errors/request-error';

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

function assertOptionalStringField(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EmailRequestError(
      `Invalid ${field} (must be a non-empty string)`,
      400,
    );
  }
}

function assertOptionalAddressListField(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    if (!value.trim()) {
      throw new EmailRequestError(
        `Invalid sendMailOptions.${field} (must be a non-empty string)`,
        400,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    if (
      value.length === 0 ||
      !value.every((item) => typeof item === 'string' && item.trim().length > 0)
    ) {
      throw new EmailRequestError(
        `Invalid sendMailOptions.${field} (must be a string or array of non-empty strings)`,
        400,
      );
    }
    return;
  }
  throw new EmailRequestError(
    `Invalid sendMailOptions.${field} (must be a string or array of strings)`,
    400,
  );
}

export function validateEmailRequestFields(
  body: SendEmailRequest,
  accountConfig?: EmailAccountConfig,
): void {
  if (body.account !== undefined) {
    assertOptionalStringField(body.account, 'account');
  }

  const sendMailOptions: unknown = body.sendMailOptions;
  if (sendMailOptions === undefined) {
    return;
  }

  if (
    sendMailOptions === null ||
    typeof sendMailOptions !== 'object' ||
    Array.isArray(sendMailOptions)
  ) {
    throw new EmailRequestError('Field sendMailOptions must be an object', 400);
  }

  const options = sendMailOptions as SendEmailRequest['sendMailOptions'] &
    Record<string, unknown>;

  const knownKeys = new Set([
    ...COMMON_SEND_MAIL_KEYS,
    ...ZEPTOMAIL_SEND_MAIL_KEYS,
  ]);
  const unknownKeys = Object.keys(options).filter((key) => !knownKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new EmailRequestError(
      `Unknown sendMailOptions field(s): ${unknownKeys.join(', ')}`,
      400,
    );
  }

  if (accountConfig && accountConfig.type !== 'zeptomail') {
    const providerOnly = Object.keys(options).filter((key) =>
      ZEPTOMAIL_SEND_MAIL_KEYS.has(key),
    );
    if (providerOnly.length > 0) {
      throw new EmailRequestError(
        `sendMailOptions field(s) ${providerOnly.join(', ')} are only supported for Zeptomail accounts`,
        400,
      );
    }
  }

  assertOptionalStringField(options.from, 'sendMailOptions.from');
  assertOptionalAddressListField(options.to, 'to');
  assertOptionalStringField(options.subject, 'sendMailOptions.subject');
  assertOptionalAddressListField(options.cc, 'cc');
  assertOptionalAddressListField(options.bcc, 'bcc');
  assertOptionalStringField(options.replyTo, 'sendMailOptions.replyTo');
  assertOptionalStringField(
    options.bounceAddress,
    'sendMailOptions.bounceAddress',
  );
  assertOptionalStringField(options.fromName, 'sendMailOptions.fromName');

  if (options.attachments !== undefined) {
    if (!Array.isArray(options.attachments)) {
      throw new EmailRequestError(
        'Invalid sendMailOptions.attachments (must be an array)',
        400,
      );
    }
  }
}
