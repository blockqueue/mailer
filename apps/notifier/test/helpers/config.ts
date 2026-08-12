import type { GlobalConfig } from '../../src/types/config';

export const TEST_API_KEY = 'test-api-key';
export const TEST_HMAC_SECRET = 'test-hmac-secret';

export function makeConfig(
  overrides: Partial<GlobalConfig> = {},
): GlobalConfig {
  return {
    auth: {
      type: 'apiKey',
      value: TEST_API_KEY,
    },
    email: {
      accounts: {
        zeptomail: {
          type: 'zeptomail',
          from: 'noreply@example.com',
          fromName: 'Notifier',
          apiKey: 'zeptomail-key',
        },
        ses: {
          type: 'ses',
          from: 'ses@example.com',
          region: 'us-east-1',
          accessKeyId: 'AKIA_TEST',
          secretAccessKey: 'secret',
        },
      },
      defaults: {
        account: 'zeptomail',
        renderer: 'html',
      },
    },
    sms: {
      accounts: {
        termii: {
          type: 'termii',
          apiKey: 'termii-key',
          from: 'MyApp',
          version: 'v3',
        },
      },
      defaults: {
        account: 'termii',
      },
    },
    ...overrides,
  };
}

export function makeHmacConfig(
  overrides: Partial<GlobalConfig> = {},
): GlobalConfig {
  return makeConfig({
    auth: {
      type: 'hmac',
      secret: TEST_HMAC_SECRET,
      tolerance: 300,
    },
    ...overrides,
  });
}
