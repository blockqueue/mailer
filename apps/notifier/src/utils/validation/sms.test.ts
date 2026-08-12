import { describe, expect, it } from 'vitest';
import { validateSmsRequest } from './sms';

describe('validateSmsRequest', () => {
  it('accepts a valid request', () => {
    expect(() =>
      validateSmsRequest({
        to: '23490126727',
        body: 'Hello',
      }),
    ).not.toThrow();
  });

  it('requires to and a non-empty body', () => {
    expect(() => validateSmsRequest({ body: 'Hello' })).toThrow(
      /Missing required field: to/,
    );
    expect(() => validateSmsRequest({ to: '23490126727' })).toThrow(
      /body \(must be a string\)/,
    );
    expect(() => validateSmsRequest({ to: '23490126727', body: '  ' })).toThrow(
      /Missing required field: body/,
    );
  });

  it('rejects more than 100 recipients', () => {
    const to = Array.from(
      { length: 101 },
      (_, i) => `23490126${String(i).padStart(3, '0')}`,
    );
    expect(() => validateSmsRequest({ to, body: 'Hello' })).toThrow(
      /at most 100 recipients/,
    );
  });

  it('rejects unknown sendOptions keys', () => {
    expect(() =>
      validateSmsRequest({
        to: '23490126727',
        body: 'Hello',
        sendOptions: { extra: true },
      }),
    ).toThrow(/Unknown sendOptions field\(s\): extra/);
  });

  it('rejects version when the account has baseUrl', () => {
    expect(() =>
      validateSmsRequest(
        {
          to: '23490126727',
          body: 'Hello',
          sendOptions: { version: 'v4' },
        },
        { type: 'termii', apiKey: 'key', baseUrl: 'https://custom.example' },
      ),
    ).toThrow(/cannot be used when the account has baseUrl set/);
  });

  it('rejects invalid channel, messageType, and version', () => {
    expect(() =>
      validateSmsRequest({
        to: '23490126727',
        body: 'Hello',
        sendOptions: { channel: 'other' },
      }),
    ).toThrow(/channel must be "dnd" or "generic"/);
    expect(() =>
      validateSmsRequest({
        to: '23490126727',
        body: 'Hello',
        sendOptions: { messageType: 'other' },
      }),
    ).toThrow(/messageType must be "plain" or "unicode"/);
    expect(() =>
      validateSmsRequest({
        to: '23490126727',
        body: 'Hello',
        sendOptions: { version: 'v5' },
      }),
    ).toThrow(/version must be "v3" or "v4"/);
  });

  it('rejects a non-object body', () => {
    expect(() => validateSmsRequest([])).toThrow(
      'Request body must be a JSON object',
    );
  });
});
