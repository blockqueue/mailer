/** Structures matching /config/config.yaml */
export interface ApiKeyAuthConfig {
  type: 'apiKey';
  header?: string; // Default: 'x-mailer-api-key'
  value: string; // Can contain ${VAR} env substitution
}

export interface HmacAuthConfig {
  type: 'hmac';
  header?: string; // Default: 'x-mailer-signature'
  secret: string; // Can contain ${VAR} env substitution
  tolerance?: number; // Timestamp tolerance in seconds (default: 300)
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
  apiKey: string;
  bounceAddress?: string;
}

export type AccountConfig = SesAccountConfig | ZeptomailAccountConfig;

export interface DefaultsConfig {
  account?: string;
  renderer?: 'react-email' | 'mjml' | 'html';
}

export interface RequestValidationConfig {
  maxBodySize?: number; // bytes (default: 1MB)
}

export interface GlobalConfig {
  auth: AuthConfig;
  accounts: Record<string, AccountConfig>;
  defaults?: DefaultsConfig;
  requestValidation?: RequestValidationConfig;
}
