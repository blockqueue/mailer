import {
  ALLOWED_CHANNELS,
  ALLOWED_MESSAGE_TYPES,
  ALLOWED_VERSIONS,
} from '../../services/sms/termii-client';
import type { SmsAccountConfig } from '../../types/config';
import type { SendSmsRequest } from '../../types/request';
import { SmsRequestError } from '../errors/request-error';

const SEND_OPTIONS_KEYS = new Set([
  'version',
  'from',
  'channel',
  'messageType',
]);

function assertNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SmsRequestError(
      `Missing or invalid field: ${field} (must be a non-empty string)`,
      400,
    );
  }
}

function validateToField(to: unknown): void {
  if (to === undefined || to === null) {
    throw new SmsRequestError('Missing required field: to', 400);
  }

  if (typeof to === 'string') {
    if (!to.trim()) {
      throw new SmsRequestError('Missing required field: to', 400);
    }
    return;
  }

  if (Array.isArray(to)) {
    if (to.length === 0) {
      throw new SmsRequestError('Missing required field: to', 400);
    }
    if (to.length > 100) {
      throw new SmsRequestError(
        'Termii accepts at most 100 recipients per send',
        400,
      );
    }
    for (const item of to) {
      if (typeof item !== 'string' || !item.trim()) {
        throw new SmsRequestError(
          'Field to must be a string or array of non-empty strings',
          400,
        );
      }
    }
    return;
  }

  throw new SmsRequestError(
    'Field to must be a string or array of strings',
    400,
  );
}

function validateSendOptions(
  sendOptions: unknown,
  accountConfig?: SmsAccountConfig,
): void {
  if (sendOptions === undefined) {
    return;
  }

  if (
    sendOptions === null ||
    typeof sendOptions !== 'object' ||
    Array.isArray(sendOptions)
  ) {
    throw new SmsRequestError('Field sendOptions must be an object', 400);
  }

  const opts = sendOptions as Record<string, unknown>;
  const unknownKeys = Object.keys(opts).filter(
    (key) => !SEND_OPTIONS_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new SmsRequestError(
      `Unknown sendOptions field(s): ${unknownKeys.join(', ')}`,
      400,
    );
  }

  if (opts.version !== undefined) {
    if (
      typeof opts.version !== 'string' ||
      !ALLOWED_VERSIONS.has(opts.version)
    ) {
      throw new SmsRequestError(
        'sendOptions.version must be "v3" or "v4"',
        400,
      );
    }
  }

  if (opts.channel !== undefined) {
    if (
      typeof opts.channel !== 'string' ||
      !ALLOWED_CHANNELS.has(opts.channel)
    ) {
      throw new SmsRequestError(
        'sendOptions.channel must be "dnd" or "generic"',
        400,
      );
    }
  }

  if (opts.messageType !== undefined) {
    if (
      typeof opts.messageType !== 'string' ||
      !ALLOWED_MESSAGE_TYPES.has(opts.messageType)
    ) {
      throw new SmsRequestError(
        'sendOptions.messageType must be "plain" or "unicode"',
        400,
      );
    }
  }

  if (opts.from !== undefined) {
    assertNonEmptyString(opts.from, 'sendOptions.from');
  }

  if (accountConfig?.baseUrl?.trim() && opts.version !== undefined) {
    throw new SmsRequestError(
      'sendOptions.version cannot be used when the account has baseUrl set',
      400,
    );
  }
}

export function validateSmsRequest(
  body: unknown,
  accountConfig?: SmsAccountConfig,
): asserts body is SendSmsRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new SmsRequestError('Request body must be a JSON object', 400);
  }

  const req = body as Record<string, unknown>;

  validateToField(req.to);

  if (typeof req.body !== 'string') {
    throw new SmsRequestError(
      'Missing or invalid field: body (must be a string)',
      400,
    );
  }
  if (!req.body.trim()) {
    throw new SmsRequestError('Missing required field: body', 400);
  }

  if (req.account !== undefined) {
    assertNonEmptyString(req.account, 'account');
  }

  validateSendOptions(req.sendOptions, accountConfig);
}
