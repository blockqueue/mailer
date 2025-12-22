import type { Transporter, TransportOptions } from 'nodemailer';
import nodemailer from 'nodemailer';
import type { AccountConfig } from '../../types/config';

/**
 * Create a nodemailer transport from account configuration
 * Supports all nodemailer transport types
 */
export function createTransport(accountConfig: AccountConfig): Transporter {
  const { type, ...options } = accountConfig;

  switch (type) {
    case 'smtp':
      return nodemailer.createTransport({
        ...options,
      } as TransportOptions);

    case 'sendmail':
      return nodemailer.createTransport({
        sendmail: true,
        ...options,
      });

    case 'ses':
      // SES requires @aws-sdk/client-ses package
      // For now, we'll pass through the options
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return nodemailer.createTransport({
        SES: options,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as Transporter;

    case 'stream':
      return nodemailer.createTransport({
        streamTransport: true,
        ...options,
      });

    default:
      // Support custom transports
      // The options should contain the transport configuration
      return nodemailer.createTransport(options as TransportOptions);
  }
}
