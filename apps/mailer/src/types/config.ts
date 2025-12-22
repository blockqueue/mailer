/**
 * Global configuration structure matching /config/config.yaml
 */

export interface AuthConfig {
  type: 'apiKey';
  header: string;
  value: string; // Can contain ${API_KEY} env var placeholder
}

export interface SmtpAccountConfig {
  type: 'smtp';
  from?: string;
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  [key: string]: unknown; // Allow any nodemailer SMTP options
}

export interface SendmailAccountConfig {
  type: 'sendmail';
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow any nodemailer sendmail options
}

export interface SesAccountConfig {
  type: 'ses';
  region?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow any nodemailer SES options
}

export interface StreamAccountConfig {
  type: 'stream';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow any nodemailer stream options
}

export type AccountConfig =
  | SmtpAccountConfig
  | SendmailAccountConfig
  | SesAccountConfig
  | StreamAccountConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: string; [key: string]: any }; // Support custom transports

export interface DefaultsConfig {
  account?: string;
  renderer?: 'react-email' | 'mjml' | 'html';
}

export interface GlobalConfig {
  auth: AuthConfig;
  accounts: Record<string, AccountConfig>;
  defaults?: DefaultsConfig;
}
