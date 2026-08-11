import * as fs from 'fs';
import { SesEmailClient } from '../../services/email/ses-client';
import { ZeptomailEmailClient } from '../../services/email/zeptomail-client';
import { TermiiSmsClient } from '../../services/sms/termii-client';
import type { GlobalConfig } from '../../types/config';
import { loadYamlWithEnv } from './yaml.loader';

const CONFIG_PATH = process.env.CONFIG_PATH ?? '/config/config.yaml';

export function loadConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found at ${CONFIG_PATH}. Bake config into the image (see examples/notifier-service) or set CONFIG_PATH for local development.`,
    );
  }

  const config = loadYamlWithEnv(CONFIG_PATH) as GlobalConfig;

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

  if (config.auth.type === 'apiKey') {
    if (!config.auth.value) {
      throw new Error('Config auth.value is required for apiKey auth');
    }
  } else {
    if (!config.auth.secret) {
      throw new Error('Config auth.secret is required for hmac auth');
    }
  }

  const hasEmail =
    config.email?.accounts && Object.keys(config.email.accounts).length > 0;
  const hasSms =
    config.sms?.accounts && Object.keys(config.sms.accounts).length > 0;

  if (!hasEmail && !hasSms) {
    throw new Error(
      'Config must define at least one account under email.accounts or sms.accounts',
    );
  }

  if (config.email?.accounts) {
    for (const accountId of Object.keys(config.email.accounts)) {
      const accountConfig = config.email.accounts[accountId];
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
            throw new Error(`Unknown email account type: ${String(_exhaustive)}`);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Email account "${accountId}" validation failed: ${errorMessage}`,
        );
      }
    }
  }

  if (config.sms?.accounts) {
    for (const accountId of Object.keys(config.sms.accounts)) {
      const accountConfig = config.sms.accounts[accountId];
      try {
        const type = (accountConfig as { type: string }).type;
        if (type !== 'termii') {
          throw new Error(`Unknown SMS account type: ${type}`);
        }
        TermiiSmsClient.validateCredentials(accountConfig);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `SMS account "${accountId}" validation failed: ${errorMessage}`,
        );
      }
    }
  }

  return config;
}
