import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { ZeptomailAccountConfig } from '../../types/config';
import { EmailRequestError } from '../../utils/errors/request-error';
import { parseEmailAddress } from '../../utils/parseEmailAddress';
import { toArray } from '../../utils/to-array';
import type { EmailOptions, SendResult } from './base-client';
import { EmailClient } from './base-client';

export interface ZeptomailEmailOptions extends EmailOptions {
  fromName?: string;
  bounceAddress?: string;
}

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

export class ZeptomailEmailClient extends EmailClient<
  ZeptomailAccountConfig,
  ZeptomailEmailOptions
> {
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

  static validateCredentials(config: ZeptomailAccountConfig): void {
    const apiKey = config.apiKey;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('Zeptomail account is missing required field: apiKey');
    }
  }

  async send(options: ZeptomailEmailOptions): Promise<SendResult> {
    try {
      const toAddresses = toArray(options.to)?.map(
        (address) => parseEmailAddress(address).address,
      );
      if (!toAddresses || toAddresses.length === 0) {
        throw new EmailRequestError('At least one recipient is required', 400);
      }

      const fromAddress = options.from || this.fromAddress;
      if (!fromAddress) {
        throw new EmailRequestError('From address is required', 400);
      }

      const parsedFrom = parseEmailAddress(fromAddress);
      const fromName =
        options.fromName?.trim() ??
        this.config.fromName?.trim() ??
        parsedFrom.name ??
        parsedFrom.address;

      const ccAddresses = toArray(options.cc)?.map(
        (address) => parseEmailAddress(address).address,
      );
      const bccAddresses = toArray(options.bcc)?.map(
        (address) => parseEmailAddress(address).address,
      );

      const mapRecipient = (address: string) => ({
        email_address: {
          address,
          name: address,
        },
      });

      const replyTo = options.replyTo
        ? parseEmailAddress(options.replyTo)
        : undefined;

      const payload = {
        from: { address: parsedFrom.address, name: fromName },
        to: toAddresses.map((address) => ({ email_address: { address } })),
        ...(ccAddresses && { cc: ccAddresses.map(mapRecipient) }),
        ...(bccAddresses && { bcc: bccAddresses.map(mapRecipient) }),
        ...(replyTo && {
          reply_to: [
            {
              address: replyTo.address,
              name: replyTo.name ?? replyTo.address,
            },
          ],
        }),
        ...(options.bounceAddress && {
          bounce_address: parseEmailAddress(options.bounceAddress).address,
        }),
        subject: options.subject,
        htmlbody: options.html,
        attachments: options.attachments?.map((att) => {
          let content: string;
          if (typeof att.content === 'string') {
            content = att.content;
          } else if (Buffer.isBuffer(att.content)) {
            content = att.content.toString('base64');
          } else {
            throw new EmailRequestError(
              `Invalid attachment content for ${att.filename ?? 'unknown'}`,
              400,
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

      const messageId = resp.data.request_id?.trim() ?? '';
      if (!messageId) {
        throw new EmailRequestError(
          'Zeptomail response missing request_id',
          502,
        );
      }

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof EmailRequestError) {
        throw error;
      }
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
