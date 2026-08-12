import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { EmailRequestError } from '../utils/errors/request-error';
import { handleChannelError } from './handle-channel-error';

async function invoke(error: unknown, providerLabel = 'Email') {
  const app = new Hono();
  app.get('/', (c) =>
    handleChannelError(c, error, {
      providerLabel,
      logMessage: 'test error',
    }),
  );
  return app.request('/');
}

describe('handleChannelError', () => {
  it('returns the original 400 message', async () => {
    const response = await invoke(new EmailRequestError('Missing to', 400));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Missing to',
    });
  });

  it('sanitizes 502 provider errors', async () => {
    const response = await invoke(
      new EmailRequestError('Zeptomail exploded with secrets', 502),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Email provider error',
    });
  });

  it('returns 500 for unknown errors', async () => {
    const response = await invoke(new Error('boom'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Internal server error',
    });
  });
});
