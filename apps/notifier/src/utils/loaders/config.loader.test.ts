import { afterEach, describe, expect, it } from 'vitest';
import {
  createTempDir,
  removeTempDir,
  writeTempFile,
} from '../../../test/helpers/temp-dir';
import { loadConfig } from './config.loader';

const validAuth = `auth:\n  type: apiKey\n  value: test-key\n`;

describe('loadConfig', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await removeTempDir(dir);
    }
  });

  it('loads a valid email-only config', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(
      dir,
      'config.yaml',
      `${validAuth}
email:
  accounts:
    zeptomail:
      type: zeptomail
      apiKey: zm-key
      from: noreply@example.com
`,
    );
    const config = loadConfig(file);
    expect(config.auth.type).toBe('apiKey');
    expect(config.email?.accounts.zeptomail.type).toBe('zeptomail');
  });

  it('loads a valid SMS-only config', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(
      dir,
      'config.yaml',
      `${validAuth}
sms:
  accounts:
    termii:
      type: termii
      apiKey: termii-key
      from: MyApp
`,
    );
    const config = loadConfig(file);
    expect(config.sms?.accounts.termii.type).toBe('termii');
  });

  it('requires auth', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(
      dir,
      'config.yaml',
      `email:
  accounts:
    zeptomail:
      type: zeptomail
      apiKey: zm-key
`,
    );
    expect(() => loadConfig(file)).toThrow(/missing required field: auth/);
  });

  it('rejects an unknown auth type', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(
      dir,
      'config.yaml',
      `auth:
  type: oauth
email:
  accounts:
    zeptomail:
      type: zeptomail
      apiKey: zm-key
`,
    );
    expect(() => loadConfig(file)).toThrow(
      /auth.type must be "apiKey" or "hmac"/,
    );
  });

  it('requires apiKey value and hmac secret', async () => {
    dir = await createTempDir();
    const apiKeyFile = await writeTempFile(
      dir,
      'api.yaml',
      `auth:
  type: apiKey
email:
  accounts:
    zeptomail:
      type: zeptomail
      apiKey: zm-key
`,
    );
    expect(() => loadConfig(apiKeyFile)).toThrow(/auth.value is required/);

    const hmacFile = await writeTempFile(
      dir,
      'hmac.yaml',
      `auth:
  type: hmac
email:
  accounts:
    zeptomail:
      type: zeptomail
      apiKey: zm-key
`,
    );
    expect(() => loadConfig(hmacFile)).toThrow(/auth.secret is required/);
  });

  it('requires at least one account', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(dir, 'config.yaml', validAuth);
    expect(() => loadConfig(file)).toThrow(/at least one account/);
  });

  it('validates SES, Zeptomail, and Termii credentials', async () => {
    dir = await createTempDir();
    const ses = await writeTempFile(
      dir,
      'ses.yaml',
      `${validAuth}
email:
  accounts:
    ses:
      type: ses
      region: us-east-1
      accessKeyId: id
`,
    );
    expect(() => loadConfig(ses)).toThrow(/secretAccessKey/);

    const zepto = await writeTempFile(
      dir,
      'zepto.yaml',
      `${validAuth}
email:
  accounts:
    zeptomail:
      type: zeptomail
      apiKey: "  "
`,
    );
    expect(() => loadConfig(zepto)).toThrow(/apiKey/);

    const sms = await writeTempFile(
      dir,
      'sms.yaml',
      `${validAuth}
sms:
  accounts:
    termii:
      type: termii
      apiKey: "  "
`,
    );
    expect(() => loadConfig(sms)).toThrow(/apiKey/);
  });

  it('rejects unknown account types', async () => {
    dir = await createTempDir();
    const email = await writeTempFile(
      dir,
      'email.yaml',
      `${validAuth}
email:
  accounts:
    other:
      type: sendgrid
      apiKey: key
`,
    );
    expect(() => loadConfig(email)).toThrow(/Unknown email account type/);

    const sms = await writeTempFile(
      dir,
      'sms.yaml',
      `${validAuth}
sms:
  accounts:
    other:
      type: twilio
      apiKey: key
`,
    );
    expect(() => loadConfig(sms)).toThrow(/Unknown SMS account type/);
  });

  it('throws when the file is missing', () => {
    expect(() => loadConfig('/tmp/missing-notifier-config.yaml')).toThrow(
      /Config file not found/,
    );
  });
});
