import type { SendEmailCommandOutput } from '@aws-sdk/client-ses';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { addProxyToClient } from 'aws-sdk-v3-proxy';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { SesAccountConfig } from '../../types/config';
import { getErrorMessage } from '../../utils/errors/error-details';
import { EmailRequestError } from '../../utils/errors/request-error';
import { toArray } from '../../utils/to-array';
import type { EmailOptions, SendResult } from './base-client';
import { EmailClient } from './base-client';

export class SesEmailClient extends EmailClient<SesAccountConfig> {
  private readonly client: SESClient;

  constructor(config: SesAccountConfig) {
    super(config);

    const client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.client = addProxyToClient(client, { throwOnNoProxy: false });
  }

  static validateCredentials(config: SesAccountConfig): void {
    const accessKeyId = config.accessKeyId;
    if (
      !accessKeyId ||
      typeof accessKeyId !== 'string' ||
      accessKeyId.trim().length === 0
    ) {
      throw new Error('Ses account is missing required field: accessKeyId');
    }
    const secretAccessKey = config.secretAccessKey;
    if (
      !secretAccessKey ||
      typeof secretAccessKey !== 'string' ||
      secretAccessKey.trim().length === 0
    ) {
      throw new Error('Ses account is missing required field: secretAccessKey');
    }
    const region = config.region;
    if (!region || typeof region !== 'string' || region.trim().length === 0) {
      throw new Error('Ses account is missing required field: region');
    }
  }

  async send(options: EmailOptions): Promise<SendResult> {
    try {
      const toAddresses = toArray(options.to);
      const ccAddresses = toArray(options.cc);
      const bccAddresses = toArray(options.bcc);

      const mail = new MailComposer({
        from: options.from,
        to: toAddresses?.join(', ') ?? '',
        ...(ccAddresses && { cc: ccAddresses.join(', ') }),
        ...(bccAddresses && { bcc: bccAddresses.join(', ') }),
        ...(options.replyTo && { replyTo: options.replyTo }),
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((att) => {
          const content = att.content;
          if (Buffer.isBuffer(content)) {
            return {
              filename: att.filename,
              content,
              contentType: att.contentType,
            };
          }
          if (typeof content === 'string') {
            return {
              filename: att.filename,
              content,
              encoding: 'base64' as const,
              contentType: att.contentType,
            };
          }
          return {
            filename: att.filename,
            content: '',
            contentType: att.contentType,
          };
        }),
      });

      const message = await new Promise<Buffer>((resolve, reject) => {
        mail.compile().build((err, msg) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(msg);
        });
      });

      const command = new SendRawEmailCommand({
        RawMessage: { Data: message },
      });
      const response: SendEmailCommandOutput = await this.client.send(command);

      const messageId = response.MessageId?.trim() ?? '';
      if (!messageId) {
        throw new EmailRequestError('SES response missing MessageId', 502);
      }

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof EmailRequestError) {
        throw error;
      }
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to send email via SES: ${errorMessage}`);
    }
  }

  close(): Promise<void> {
    this.client.destroy();
    return Promise.resolve();
  }
}
