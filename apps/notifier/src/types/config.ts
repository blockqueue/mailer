export interface ApiKeyAuthConfig {
  type: 'apiKey';
  header?: string;
  value: string;
}

export interface HmacAuthConfig {
  type: 'hmac';
  header?: string;
  secret: string;
  tolerance?: number;
}

export type AuthConfig = ApiKeyAuthConfig | HmacAuthConfig;

export interface SesAccountConfig {
  type: 'ses';
  from?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ZeptomailAccountConfig {
  type: 'zeptomail';
  from?: string;
  fromName?: string;
  apiKey: string;
  bounceAddress?: string;
}

export type EmailAccountConfig = SesAccountConfig | ZeptomailAccountConfig;

export type TermiiApiVersion = 'v3' | 'v4';
export type TermiiChannel = 'dnd' | 'generic';
export type TermiiMessageType = 'plain' | 'unicode';

export interface TermiiAccountConfig {
  type: 'termii';
  apiKey: string;
  from?: string;
  version?: TermiiApiVersion;
  baseUrl?: string;
  channel?: TermiiChannel;
  messageType?: TermiiMessageType;
}

export type SmsAccountConfig = TermiiAccountConfig;

export interface EmailDefaultsConfig {
  account?: string;
  renderer?: 'react-email' | 'mjml' | 'html';
}

export interface SmsDefaultsConfig {
  account?: string;
}

export interface EmailChannelConfig {
  accounts: Record<string, EmailAccountConfig>;
  defaults?: EmailDefaultsConfig;
}

export interface SmsChannelConfig {
  accounts: Record<string, SmsAccountConfig>;
  defaults?: SmsDefaultsConfig;
}

export interface RequestValidationConfig {
  maxBodySize?: number;
  maxAttachmentSize?: number;
  allowedAttachmentMimeTypes?: string[];
}

export interface GlobalConfig {
  auth: AuthConfig;
  email?: EmailChannelConfig;
  sms?: SmsChannelConfig;
  requestValidation?: RequestValidationConfig;
}
