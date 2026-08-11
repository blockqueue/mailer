import type { TermiiAccountConfig } from '../../types/config';
import type { SmsOptions, SmsSendResult } from './base-client';
import { SmsClient } from './base-client';

const TERMII_HOSTS = {
  v3: 'https://v3.api.termii.com',
  v4: 'https://v4.api.termii.com',
} as const;

const ALLOWED_VERSIONS = new Set(['v3', 'v4']);
const ALLOWED_CHANNELS = new Set(['dnd', 'generic']);
const ALLOWED_MESSAGE_TYPES = new Set(['plain', 'unicode']);

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
    return account.baseUrl.replace(/\/$/, '');
  }
  const version = versionOverride ?? account.version ?? 'v3';
  return TERMII_HOSTS[version];
}

export class TermiiSmsClient extends SmsClient {
  static validateCredentials(config: TermiiAccountConfig): void {
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

  async send(options: SmsOptions): Promise<SmsSendResult> {
    const from = options.from ?? this.config.from;
    if (!from || from.trim().length === 0) {
      throw new Error('Missing required SMS field: from (sender ID)');
    }

    const to = options.to;
    if (
      !to ||
      (Array.isArray(to) && to.length === 0) ||
      (typeof to === 'string' && to.trim().length === 0)
    ) {
      throw new Error('Missing required SMS field: to');
    }
    if (Array.isArray(to) && to.length > 100) {
      throw new Error('Termii accepts at most 100 recipients per send');
    }

    if (!options.body || options.body.trim().length === 0) {
      throw new Error('Missing required SMS field: body');
    }
    const body = options.body.trim();

    const channel = options.channel ?? this.config.channel ?? 'generic';
    const messageType =
      options.messageType ?? this.config.messageType ?? 'plain';
    const baseUrl = resolveBaseUrl(this.config, options.version);
    const url = `${baseUrl}/api/sms/send`;

    const payload = {
      api_key: this.config.apiKey,
      to,
      from,
      sms: body,
      type: messageType,
      channel,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: TermiiSendResponse;
    try {
      data = JSON.parse(text) as TermiiSendResponse;
    } catch {
      throw new Error(
        `Termii returned non-JSON response (${String(response.status)}): ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok || data.code !== 'ok') {
      const detail = data.message ?? text.slice(0, 200);
      throw new Error(
        `Termii send failed (${String(response.status)}): ${detail}`,
      );
    }

    const messageId = String(
      data.message_id_str ?? data.message_id ?? '',
    ).trim();
    if (!messageId) {
      throw new Error('Termii response missing message_id');
    }

    return { messageId, success: true };
  }
}
