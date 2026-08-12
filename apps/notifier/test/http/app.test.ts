import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import {
  EmailRequestError,
  SmsRequestError,
} from '../../src/utils/errors/request-error';
import { TemplateLoader } from '../../src/utils/loaders/template.loader';
import {
  makeConfig,
  makeHmacConfig,
  TEST_API_KEY,
  TEST_HMAC_SECRET,
} from '../helpers/config';
import { signHmac } from '../helpers/hmac';
import { templatesFixtureDir } from '../helpers/paths';

const { emailClient, smsClient, createEmailClient, createSmsClient } =
  vi.hoisted(() => ({
    emailClient: {
      send: vi.fn(),
      close: vi.fn(),
    },
    smsClient: {
      send: vi.fn(),
    },
    createEmailClient: vi.fn(),
    createSmsClient: vi.fn(),
  }));

vi.mock('../../src/services/email/createEmailClient', () => ({
  createEmailClient,
}));

vi.mock('../../src/services/sms/createSmsClient', () => ({
  createSmsClient,
}));

function loadTemplates(): TemplateLoader {
  const loader = new TemplateLoader('html', templatesFixtureDir);
  const result = loader.loadAllTemplates();
  if (result.failureCount > 0) {
    throw new Error(result.failures.map((failure) => failure.error).join('; '));
  }
  return loader;
}

function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-notifier-api-key': TEST_API_KEY,
    ...extra,
  };
}

async function postJson(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  headers?: Record<string, string>,
) {
  const raw = JSON.stringify(body);
  return app.request(path, {
    method: 'POST',
    headers: jsonHeaders(headers),
    body: raw,
  });
}

describe('HTTP app', () => {
  const loader = loadTemplates();

  beforeEach(() => {
    emailClient.send.mockReset();
    emailClient.close.mockReset();
    smsClient.send.mockReset();
    createEmailClient.mockReset();
    createSmsClient.mockReset();
    createEmailClient.mockReturnValue(emailClient);
    createSmsClient.mockReturnValue(smsClient);
    emailClient.send.mockResolvedValue({
      messageId: 'email-msg-1',
      success: true,
    });
    emailClient.close.mockResolvedValue(undefined);
    smsClient.send.mockResolvedValue({
      messageId: 'sms-msg-1',
      success: true,
    });
  });

  describe('health and ready', () => {
    it('returns ok for /health without auth', async () => {
      const app = createApp(makeConfig(), loader);
      const response = await app.request('/health');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    });

    it('returns ok for /ready when templates are loaded', async () => {
      const app = createApp(makeConfig(), loader);
      const response = await app.request('/ready');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    });

    it('returns 503 for /ready when email is configured but no templates loaded', async () => {
      const empty = new TemplateLoader('html', '/tmp/notifier-empty-templates');
      empty.loadAllTemplates();
      const app = createApp(makeConfig(), empty);
      const response = await app.request('/ready');
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ status: 'not_ready' });
    });
  });

  describe('request validation', () => {
    const app = createApp(makeConfig(), loader);

    it('rejects non-JSON content types', async () => {
      const response = await app.request('/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'x-notifier-api-key': TEST_API_KEY,
        },
        body: '{}',
      });
      expect(response.status).toBe(400);
    });

    it('allows application/json with a charset', async () => {
      const response = await postJson(
        app,
        '/email/send',
        {
          templateId: 'html-welcome',
          payload: { userName: 'Ada' },
          sendMailOptions: { to: 'user@example.com' },
        },
        { 'Content-Type': 'application/json; charset=utf-8' },
      );
      expect(response.status).toBe(200);
    });

    it('rejects invalid JSON', async () => {
      const response = await app.request('/email/send', {
        method: 'POST',
        headers: jsonHeaders(),
        body: '{',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: 'Invalid JSON in request body',
      });
    });

    it('rejects a JSON array or null', async () => {
      const arrayResponse = await app.request('/email/send', {
        method: 'POST',
        headers: jsonHeaders(),
        body: '[]',
      });
      expect(arrayResponse.status).toBe(400);

      const nullResponse = await app.request('/email/send', {
        method: 'POST',
        headers: jsonHeaders(),
        body: 'null',
      });
      expect(nullResponse.status).toBe(400);
    });

    it('rejects an oversized Content-Length', async () => {
      const limited = createApp(
        makeConfig({ requestValidation: { maxBodySize: 32 } }),
        loader,
      );
      const response = await limited.request('/email/send', {
        method: 'POST',
        headers: {
          ...jsonHeaders(),
          'Content-Length': '100',
        },
        body: '{}',
      });
      expect(response.status).toBe(413);
    });
  });

  describe('auth', () => {
    it('rejects a missing API key', async () => {
      const app = createApp(makeConfig(), loader);
      const response = await app.request('/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'html-welcome',
          payload: { userName: 'Ada' },
        }),
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        message: 'Missing API key',
      });
    });

    it('rejects a wrong API key, including a different length', async () => {
      const app = createApp(makeConfig(), loader);
      const wrong = await postJson(
        app,
        '/email/send',
        { templateId: 'html-welcome', payload: { userName: 'Ada' } },
        { 'x-notifier-api-key': 'nope' },
      );
      expect(wrong.status).toBe(401);

      const length = await postJson(
        app,
        '/email/send',
        { templateId: 'html-welcome', payload: { userName: 'Ada' } },
        { 'x-notifier-api-key': 'short' },
      );
      expect(length.status).toBe(401);
    });

    it('accepts a custom API key header', async () => {
      const app = createApp(
        makeConfig({
          auth: { type: 'apiKey', header: 'x-custom-key', value: TEST_API_KEY },
        }),
        loader,
      );
      const response = await postJson(
        app,
        '/email/send',
        {
          templateId: 'html-welcome',
          payload: { userName: 'Ada' },
          sendMailOptions: { to: 'user@example.com' },
        },
        { 'x-custom-key': TEST_API_KEY, 'x-notifier-api-key': '' },
      );
      expect(response.status).toBe(200);
    });

    it('validates HMAC against the raw body', async () => {
      const app = createApp(makeHmacConfig(), loader);
      const compact =
        '{"templateId":"html-welcome","payload":{"userName":"Ada"},"sendMailOptions":{"to":"user@example.com"}}';
      const pretty = JSON.stringify(
        {
          templateId: 'html-welcome',
          payload: { userName: 'Ada' },
          sendMailOptions: { to: 'user@example.com' },
        },
        null,
        2,
      );

      const valid = await app.request('/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notifier-signature': signHmac(TEST_HMAC_SECRET, compact),
        },
        body: compact,
      });
      expect(valid.status).toBe(200);

      const mismatched = await app.request('/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notifier-signature': signHmac(TEST_HMAC_SECRET, compact),
        },
        body: pretty,
      });
      expect(mismatched.status).toBe(401);
    });

    it('rejects a missing HMAC signature', async () => {
      const app = createApp(makeHmacConfig(), loader);
      const response = await app.request('/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        message: 'Missing signature',
      });
    });
  });

  describe('POST /email/send', () => {
    const app = createApp(makeConfig(), loader);

    it('sends a rendered HTML email', async () => {
      const response = await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        payload: { userName: 'Ada' },
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        messageId: 'email-msg-1',
      });
      expect(emailClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          from: 'template@example.com',
          subject: 'Welcome',
          html: expect.stringContaining('Hello Ada'),
        }),
      );
      expect(createEmailClient).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'zeptomail' }),
      );
      expect(emailClient.close).toHaveBeenCalled();
    });

    it('rejects unknown sendMailOptions fields', async () => {
      const response = await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        payload: { userName: 'Ada' },
        sendMailOptions: { to: 'user@example.com', extra: true },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: expect.stringContaining('Unknown sendMailOptions'),
      });
    });

    it('returns 400 when templateId is missing', async () => {
      const response = await postJson(app, '/email/send', {
        payload: { userName: 'Ada' },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: 'Missing required field: templateId',
      });
    });

    it('returns payload validation details', async () => {
      const response = await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        payload: {},
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        message: string;
        details: string[];
      };
      expect(body.message).toBe('Payload validation failed');
      expect(body.details.some((detail) => detail.includes('userName'))).toBe(
        true,
      );
    });

    it('returns 404 for an unknown template', async () => {
      const response = await postJson(app, '/email/send', {
        templateId: 'missing',
        payload: { userName: 'Ada' },
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(response.status).toBe(404);
    });

    it('returns 400 when no account can be resolved', async () => {
      const noDefault = createApp(
        makeConfig({
          email: {
            accounts: {
              zeptomail: {
                type: 'zeptomail',
                from: 'noreply@example.com',
                apiKey: 'zeptomail-key',
              },
            },
            defaults: { renderer: 'html' },
          },
        }),
        loader,
      );
      const response = await postJson(noDefault, '/email/send', {
        templateId: 'mjml-otp',
        payload: { code: '1234' },
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: expect.stringContaining('No account specified'),
      });
    });

    it('returns 400 for an unknown account', async () => {
      const response = await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        account: 'unknown',
        payload: { userName: 'Ada' },
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: 'Email account not found: unknown',
      });
    });

    it('rejects Zeptomail-only fields on SES after account resolution', async () => {
      const response = await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        account: 'ses',
        payload: { userName: 'Ada' },
        sendMailOptions: {
          to: 'user@example.com',
          fromName: 'Ada',
        },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: expect.stringContaining('only supported for Zeptomail'),
      });
    });

    it('returns 503 when email is not configured', async () => {
      const smsOnly = createApp(
        makeConfig({
          email: undefined,
          sms: {
            accounts: {
              termii: { type: 'termii', apiKey: 'key', from: 'App' },
            },
            defaults: { account: 'termii' },
          },
        }),
        loader,
      );
      const response = await postJson(smsOnly, '/email/send', {
        templateId: 'html-welcome',
        payload: { userName: 'Ada' },
      });
      expect(response.status).toBe(503);
    });

    it('sanitizes provider 502 errors and still closes the client', async () => {
      emailClient.send.mockRejectedValue(
        new EmailRequestError('secret upstream', 502),
      );
      const response = await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        payload: { userName: 'Ada' },
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        success: false,
        message: 'Email provider error',
      });
      expect(emailClient.close).toHaveBeenCalled();
    });

    it('uses request.account over template.account', async () => {
      await postJson(app, '/email/send', {
        templateId: 'html-welcome',
        account: 'ses',
        payload: { userName: 'Ada' },
        sendMailOptions: { to: 'user@example.com' },
      });
      expect(createEmailClient).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ses' }),
      );
    });
  });

  describe('POST /sms/send', () => {
    const app = createApp(makeConfig(), loader);

    it('sends an SMS', async () => {
      const response = await postJson(app, '/sms/send', {
        to: '23490126727',
        body: 'Hello',
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        messageId: 'sms-msg-1',
      });
    });

    it('returns no-account before missing to', async () => {
      const noDefault = createApp(
        makeConfig({
          sms: {
            accounts: {
              termii: { type: 'termii', apiKey: 'key', from: 'App' },
            },
          },
        }),
        loader,
      );
      const response = await postJson(noDefault, '/sms/send', {
        body: 'Hello',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: expect.stringContaining('No account specified'),
      });
    });

    it('rejects version when the account has baseUrl', async () => {
      const withBaseUrl = createApp(
        makeConfig({
          sms: {
            accounts: {
              termii: {
                type: 'termii',
                apiKey: 'key',
                from: 'App',
                baseUrl: 'https://custom.example',
              },
            },
            defaults: { account: 'termii' },
          },
        }),
        loader,
      );
      const response = await postJson(withBaseUrl, '/sms/send', {
        to: '23490126727',
        body: 'Hello',
        sendOptions: { version: 'v4' },
      });
      expect(response.status).toBe(400);
    });

    it('rejects more than 100 recipients', async () => {
      const to = Array.from({ length: 101 }, () => '23490126727');
      const response = await postJson(app, '/sms/send', { to, body: 'Hello' });
      expect(response.status).toBe(400);
    });

    it('returns 503 when SMS is not configured', async () => {
      const emailOnly = createApp(
        makeConfig({
          sms: undefined,
        }),
        loader,
      );
      const response = await postJson(emailOnly, '/sms/send', {
        to: '23490126727',
        body: 'Hello',
      });
      expect(response.status).toBe(503);
    });

    it('sanitizes Termii 502 errors', async () => {
      smsClient.send.mockRejectedValue(
        new SmsRequestError('termii secret', 502),
      );
      const response = await postJson(app, '/sms/send', {
        to: '23490126727',
        body: 'Hello',
      });
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        success: false,
        message: 'SMS provider error',
      });
    });
  });
});
