import type {
  TermiiAccountConfig,
  TermiiApiVersion,
  TermiiChannel,
  TermiiMessageType,
} from '../../types/config';
import { PROVIDER_REQUEST_TIMEOUT_MS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/errors/error-details';
import { SmsRequestError } from '../../utils/errors/request-error';
import type { SmsOptions, SmsSendResult } from './base-client';
import { SmsClient } from './base-client';

export interface TermiiSmsOptions extends SmsOptions {
  version?: TermiiApiVersion;
  channel?: TermiiChannel;
  messageType?: TermiiMessageType;
}

const TERMII_HOSTS = {
  v3: 'https://v3.api.termii.com',
  v4: 'https://v4.api.termii.com',
} as const;

export const ALLOWED_VERSIONS = new Set(['v3', 'v4']);
export const ALLOWED_CHANNELS = new Set(['dnd', 'generic']);
export const ALLOWED_MESSAGE_TYPES = new Set(['plain', 'unicode']);

function isValidE164LikePhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const digits = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }
  for (const ch of digits) {
    if (ch < '0' || ch > '9') {
      return false;
    }
  }
  return true;
}

interface TermiiSendResponse {
  code?: string;
  message_id?: string | number;
  message_id_str?: string;
  message?: string;
  [key: string]: unknown;
}

function resolveBaseUrl(
  account: TermiiAccountConfig,
  versionOverride?: 'v3' | 'v4',
): string {
  if (account.baseUrl && account.baseUrl.trim().length > 0) {
    const baseUrl = account.baseUrl.trim();
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }
  const version = versionOverride ?? account.version ?? 'v3';
  return TERMII_HOSTS[version];
}

export class TermiiSmsClient extends SmsClient<
  TermiiAccountConfig,
  TermiiSmsOptions
> {
  static validateCredentials(config: TermiiAccountConfig): void {
    const type = (config as { type: string }).type;
    if (type !== 'termii') {
      throw new Error(`Expected SMS account type "termii", got: ${type}`);
    }
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error('Termii account requires apiKey');
    }
    if (config.version && !ALLOWED_VERSIONS.has(config.version)) {
      throw new Error('Termii version must be "v3" or "v4"');
    }
    if (config.channel && !ALLOWED_CHANNELS.has(config.channel)) {
      throw new Error('Termii channel must be "dnd" or "generic"');
    }
    if (config.messageType && !ALLOWED_MESSAGE_TYPES.has(config.messageType)) {
      throw new Error('Termii messageType must be "plain" or "unicode"');
    }
  }

  async send(options: TermiiSmsOptions): Promise<SmsSendResult> {
    const hasBaseUrl = Boolean(this.config.baseUrl?.trim());
    if (hasBaseUrl && options.version) {
      throw new SmsRequestError(
        'sendOptions.version cannot be used when the account has baseUrl set',
        400,
      );
    }

    const from = (options.from ?? this.config.from)?.trim();
    if (!from) {
      throw new SmsRequestError(
        'Missing required SMS field: from (sender ID)',
        400,
      );
    }

    const to = options.to;
    if (
      !to ||
      (Array.isArray(to) && to.length === 0) ||
      (typeof to === 'string' && to.trim().length === 0)
    ) {
      throw new SmsRequestError('Missing required SMS field: to', 400);
    }
    if (Array.isArray(to) && to.length > 100) {
      throw new SmsRequestError(
        'Termii accepts at most 100 recipients per send',
        400,
      );
    }

    const rawRecipients = Array.isArray(to) ? to : [to];
    if (rawRecipients.some((recipient) => typeof recipient !== 'string')) {
      throw new SmsRequestError(
        'Field to must be a string or array of strings',
        400,
      );
    }
    const recipients = rawRecipients.map((recipient) => recipient.trim());
    const invalidRecipients = recipients.filter(
      (recipient) => !isValidE164LikePhone(recipient),
    );
    if (invalidRecipients.length > 0) {
      throw new SmsRequestError(
        `Invalid phone number(s): ${invalidRecipients.join(', ')}`,
        400,
      );
    }

    if (typeof options.body !== 'string' || options.body.trim().length === 0) {
      throw new SmsRequestError('Missing required SMS field: body', 400);
    }
    const body = options.body.trim();

    if (options.channel && !ALLOWED_CHANNELS.has(options.channel)) {
      throw new SmsRequestError(
        'sendOptions.channel must be "dnd" or "generic"',
        400,
      );
    }
    if (
      options.messageType &&
      !ALLOWED_MESSAGE_TYPES.has(options.messageType)
    ) {
      throw new SmsRequestError(
        'sendOptions.messageType must be "plain" or "unicode"',
        400,
      );
    }
    if (options.version && !ALLOWED_VERSIONS.has(options.version)) {
      throw new SmsRequestError(
        'sendOptions.version must be "v3" or "v4"',
        400,
      );
    }

    const channel = options.channel ?? this.config.channel ?? 'generic';
    const messageType =
      options.messageType ?? this.config.messageType ?? 'plain';
    const baseUrl = resolveBaseUrl(this.config, options.version);
    const url = `${baseUrl}/api/sms/send`;

    const payload = {
      api_key: this.config.apiKey,
      to: Array.isArray(to) ? recipients : recipients[0],
      from,
      sms: body,
      type: messageType,
      channel,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      const detail = getErrorMessage(error);
      throw new SmsRequestError(`Termii request failed: ${detail}`, 502);
    }

    const text = await response.text();
    let data: TermiiSendResponse;
    try {
      data = JSON.parse(text) as TermiiSendResponse;
    } catch {
      throw new SmsRequestError(
        `Termii returned non-JSON response (${String(response.status)}): ${text.slice(0, 200)}`,
        502,
      );
    }

    if (!response.ok || data.code !== 'ok') {
      const detail = data.message ?? text.slice(0, 200);
      throw new SmsRequestError(
        `Termii send failed (${String(response.status)}): ${detail}`,
        502,
      );
    }

    const messageId = String(
      data.message_id_str ?? data.message_id ?? '',
    ).trim();
    if (!messageId) {
      throw new SmsRequestError('Termii response missing message_id', 502);
    }

    return { messageId, success: true };
  }
}
