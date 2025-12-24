/**
 * Global configuration structure matching /config/config.yaml
 */

export interface ApiKeyAuthConfig {
  type: 'apiKey';
  header?: string; // Default: 'x-mailer-api-key'
  value: string; // Can contain ${VAR} env substitution
}

export interface HmacAuthConfig {
  type: 'hmac';
  header?: string; // Default: 'x-mailer-signature'
  secret: string; // Can contain ${VAR} env substitution
  tolerance?: number; // Timestamp tolerance in seconds (default: 300 = 5 minutes)
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

export interface RateLimitConfig {
  enabled?: boolean; // Default: false (optional feature)
  windowMinutes?: number; // User-defined
  maxRequests?: number; // User-defined limit per window
  windowHours?: number; // User-defined
  maxRequestsPerHour?: number; // User-defined limit per hour
  // Note: Rate limiting tracks by IP only (simplified for server-to-server)
  // Strongly recommended to use IP allowlisting alongside rate limiting
}

export interface IpAllowlistConfig {
  enabled?: boolean; // Default: false (optional feature)
  allowedIps?: string[]; // IPs or CIDR blocks (e.g., ['192.168.1.0/24', '10.0.0.1'])
}

export interface RequestValidationConfig {
  maxBodySize?: number; // Maximum request body size in bytes (default: 1048576 = 1MB)
}

export interface GlobalConfig {
  auth: AuthConfig;
  accounts: Record<string, AccountConfig>;
  defaults?: DefaultsConfig;
  rateLimit?: RateLimitConfig; // Optional - users configure their own limits
  ipAllowlist?: IpAllowlistConfig; // Optional - can reduce need for rate limiting
  requestValidation?: RequestValidationConfig; // Optional - request validation settings
}
