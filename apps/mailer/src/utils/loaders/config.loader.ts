import * as fs from 'fs';
import { SesEmailClient } from '../../services/mailer/ses-client';
import { ZeptomailEmailClient } from '../../services/mailer/zeptomail-client';
import type { GlobalConfig } from '../../types/config';
import { loadYamlWithEnv } from './yaml.loader';

const CONFIG_PATH = process.env.CONFIG_PATH ?? '/config/config.yaml';

/** Load and validate global configuration from YAML */
export function loadConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found at ${CONFIG_PATH}. Bake config into the image (see examples/mail-service) or set CONFIG_PATH for local development.`,
    );
  }

  const config = loadYamlWithEnv(CONFIG_PATH) as GlobalConfig;

  // Runtime validation — YAML parsing might not match types
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!config.auth || typeof config.auth !== 'object') {
    throw new Error('Config is missing required field: auth');
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!config.auth.type || !['apiKey', 'hmac'].includes(config.auth.type)) {
    throw new Error(
      `Config auth.type must be "apiKey" or "hmac", got: ${config.auth.type}`,
    );
  }

  // Discriminated union: validate credentials per auth type
  if (config.auth.type === 'apiKey') {
    if (!config.auth.value) {
      throw new Error('Config auth.value is required for apiKey auth');
    }
  } else {
    if (!config.auth.secret) {
      throw new Error('Config auth.secret is required for hmac auth');
    }
  }
  if (Object.keys(config.accounts).length === 0) {
    throw new Error('Config must have at least one account in accounts');
  }

  for (const accountId of Object.keys(config.accounts)) {
    const accountConfig = config.accounts[accountId];

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
