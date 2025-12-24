import * as fs from 'fs';
import { SesEmailClient } from '../../services/mailer/ses-client';
import { ZeptomailEmailClient } from '../../services/mailer/zeptomail-client';
import type { GlobalConfig } from '../../types/config';
import { loadYamlWithEnv } from './yaml.loader';

const CONFIG_PATH = process.env.CONFIG_PATH ?? '/config/config.yaml';

/**
 * Load and validate global configuration
 */
export function loadConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found at ${CONFIG_PATH}. Make sure it's mounted as a volume.`,
    );
  }

  const config = loadYamlWithEnv(CONFIG_PATH) as GlobalConfig;

  // Validate required fields at runtime (YAML parsing might not match types)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!config.auth || typeof config.auth !== 'object') {
    throw new Error('Config is missing required field: auth');
  }
  // Validate auth type at runtime (YAML might have wrong type)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!config.auth.type || !['apiKey', 'hmac'].includes(config.auth.type)) {
    throw new Error(
      `Config auth.type must be "apiKey" or "hmac", got: ${config.auth.type}`,
    );
  }

  // Validate based on auth type (discriminated union)
  if (config.auth.type === 'apiKey') {
    if (!config.auth.value) {
      throw new Error('Config auth.value is required for apiKey auth');
    }
    // header is optional for API key, defaults to 'x-mailer-api-key'
  } else {
    // TypeScript narrows this to 'hmac' after the apiKey check
    if (!config.auth.secret) {
      throw new Error('Config auth.secret is required for hmac auth');
    }
    // header is optional for HMAC, defaults to 'x-mailer-signature'
  }
  if (Object.keys(config.accounts).length === 0) {
    throw new Error('Config must have at least one account in accounts');
  }

  // Validate each account has a type and required credentials
  for (const accountId of Object.keys(config.accounts)) {
    const accountConfig = config.accounts[accountId];

    // Validate account-specific credentials
    try {
      switch (accountConfig.type) {
        case 'ses':
          SesEmailClient.validateCredentials(accountConfig);
          break;
        case 'zeptomail':
          ZeptomailEmailClient.validateCredentials(accountConfig);
          break;
        default: {
          const _exhaustive: never = accountConfig;
          throw new Error(`Unknown account type: ${String(_exhaustive)}`);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Account "${accountId}" validation failed: ${errorMessage}`,
      );
    }
  }

  return config;
}
