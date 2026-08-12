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
      `Invalid sendMailOptions.${field} (must be a non-empty string)`,
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

  const sendMailOptions = body.sendMailOptions;
  if (sendMailOptions === undefined) {
    return;
  }

  if (typeof sendMailOptions !== 'object' || Array.isArray(sendMailOptions)) {
    throw new EmailRequestError('Field sendMailOptions must be an object', 400);
  }

  const knownKeys = new Set([
    ...COMMON_SEND_MAIL_KEYS,
    ...ZEPTOMAIL_SEND_MAIL_KEYS,
  ]);
  const unknownKeys = Object.keys(sendMailOptions).filter(
    (key) => !knownKeys.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new EmailRequestError(
      `Unknown sendMailOptions field(s): ${unknownKeys.join(', ')}`,
      400,
    );
  }

  if (accountConfig && accountConfig.type !== 'zeptomail') {
    const providerOnly = Object.keys(sendMailOptions).filter((key) =>
      ZEPTOMAIL_SEND_MAIL_KEYS.has(key),
    );
    if (providerOnly.length > 0) {
      throw new EmailRequestError(
        `sendMailOptions field(s) ${providerOnly.join(', ')} are only supported for Zeptomail accounts`,
        400,
      );
    }
  }

  assertOptionalStringField(sendMailOptions.from, 'from');
  assertOptionalAddressListField(sendMailOptions.to, 'to');
  assertOptionalStringField(sendMailOptions.subject, 'subject');
  assertOptionalAddressListField(sendMailOptions.cc, 'cc');
  assertOptionalAddressListField(sendMailOptions.bcc, 'bcc');
  assertOptionalStringField(sendMailOptions.replyTo, 'replyTo');
  assertOptionalStringField(sendMailOptions.bounceAddress, 'bounceAddress');
  assertOptionalStringField(sendMailOptions.fromName, 'fromName');

  if (sendMailOptions.attachments !== undefined) {
    if (!Array.isArray(sendMailOptions.attachments)) {
      throw new EmailRequestError(
        'Invalid sendMailOptions.attachments (must be an array)',
        400,
      );
    }
  }
}
