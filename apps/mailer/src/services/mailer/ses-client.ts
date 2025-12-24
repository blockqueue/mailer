import type { SendEmailCommandOutput } from '@aws-sdk/client-ses';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { SesAccountConfig } from '../../types/config';
import type { EmailOptions, SendResult } from './base-client';
import { EmailClient } from './base-client';

/**
 * AWS SES email client implementation
 */
export class SesEmailClient extends EmailClient<SesAccountConfig> {
  private readonly client: SESClient;

  constructor(config: SesAccountConfig) {
    super(config);

    this.client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private toArray(value: string | string[] | undefined): string[] | undefined {
    return value ? (Array.isArray(value) ? value : [value]) : undefined;
  }

  /**
   * Validate that all required Ses credentials are present
   */
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

  /**
   * Send an email via AWS SES
   */
  async send(options: EmailOptions): Promise<SendResult> {
    try {
      const toAddresses = this.toArray(options.to);
      const ccAddresses = this.toArray(options.cc);
      const bccAddresses = this.toArray(options.bcc);

      const mail = new MailComposer({
        from: options.from,
        to: toAddresses?.join(', ') ?? '',
        ...(ccAddresses && { cc: ccAddresses.join(', ') }),
        ...(bccAddresses && { bcc: bccAddresses.join(', ') }),
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content as string,
          contentType: att.contentType,
        })),
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

      return {
        messageId: response.MessageId ?? '',
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to send email via SES: ${errorMessage}`);
    }
  }
}
