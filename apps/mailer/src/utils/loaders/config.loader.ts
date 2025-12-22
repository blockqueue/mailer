import * as fs from 'fs';
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
  if (config.auth.type !== 'apiKey') {
    throw new Error(
      `Config auth.type must be "apiKey", got: ${String(config.auth.type)}`,
    );
  }

  if (!config.auth.header) {
    throw new Error('Config auth.header is required');
  }
  if (!config.auth.value) {
    throw new Error('Config auth.value is required');
  }
  if (Object.keys(config.accounts).length === 0) {
    throw new Error('Config must have at least one account in accounts');
  }

  // Validate each account has a type
  for (const [accountId, account] of Object.entries(config.accounts)) {
    if (!account.type) {
      throw new Error(`Account "${accountId}" is missing required field: type`);
    }
  }

  return config;
}
