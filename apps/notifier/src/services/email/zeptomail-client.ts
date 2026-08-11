import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { ZeptomailAccountConfig } from '../../types/config';
import type { EmailOptions, SendResult } from './base-client';
import { EmailClient } from './base-client';

interface ZeptomailSendResponse {
  data?: {
    code?: string;
    message?: string;
    additional_info?: unknown[];
  }[];
  message?: string;
  request_id?: string;
  object?: string;
}

export class ZeptomailEmailClient extends EmailClient<ZeptomailAccountConfig> {
  private readonly client: AxiosInstance;
  private readonly fromAddress: string;

  constructor(config: ZeptomailAccountConfig) {
    super(config);
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error('Zeptomail apiKey is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.zeptomail.com/v1.1',
      headers: {
        Authorization: config.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    this.fromAddress = config.from ?? '';
  }

  private toArray(value: string | string[] | undefined): string[] | undefined {
    return value ? (Array.isArray(value) ? value : [value]) : undefined;
  }

  static validateCredentials(config: ZeptomailAccountConfig): void {
    const apiKey = config.apiKey;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('Zeptomail account is missing required field: apiKey');
    }
  }

  async send(options: EmailOptions): Promise<SendResult> {
    try {
      const toAddresses = this.toArray(options.to);
      if (!toAddresses || toAddresses.length === 0) {
        throw new Error('At least one recipient is required');
      }

      const fromAddress = options.from || this.fromAddress;
      if (!fromAddress) {
        throw new Error('From address is required');
      }

      const payload = {
        from: { address: fromAddress, name: 'noreply' },
        to: toAddresses.map((address) => ({ email_address: { address } })),
        subject: options.subject,
        htmlbody: options.html,
        attachments: options.attachments?.map((att) => {
          let content: string;
          if (typeof att.content === 'string') {
            content = att.content;
          } else if (Buffer.isBuffer(att.content)) {
            content = att.content.toString('base64');
          } else {
            throw new Error(
              `Invalid attachment content for ${att.filename ?? 'unknown'}`,
            );
          }

          return {
            filename: att.filename ?? 'attachment',
            content,
            content_type: att.contentType,
          };
        }),
      };

      const resp = await this.client.post<ZeptomailSendResponse>(
        '/email',
        payload,
      );

      return {
        messageId: resp.data.request_id ?? '',
        success: true,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as
          | { error?: { message?: string } }
          | undefined;
        const errorMessage =
          errorData?.error?.message ??
          error.response?.statusText ??
          error.message;
        throw new Error(`Zeptomail API error: ${errorMessage}`);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to send email via Zeptomail: Unknown error');
    }
  }
}
