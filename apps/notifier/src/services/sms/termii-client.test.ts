import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSmsClient } from './createSmsClient';
import { TermiiSmsClient } from './termii-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('TermiiSmsClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the v3 host by default', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'ok', message_id: 'sms-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
    });
    expect(client).toBeInstanceOf(TermiiSmsClient);
    const result = await client.send({
      to: '23490126727',
      body: 'Hello',
    });

    expect(result).toEqual({ messageId: 'sms-1', success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://v3.api.termii.com/api/sms/send',
      expect.objectContaining({ method: 'POST' }),
    );
    const payload = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(payload).toEqual({
      api_key: 'termii-key',
      to: '23490126727',
      from: 'MyApp',
      sms: 'Hello',
      type: 'plain',
      channel: 'generic',
    });
  });

  it('uses the v4 host when version is overridden', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'ok', message_id_str: 'sms-4' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new TermiiSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
      version: 'v3',
    });
    await client.send({
      to: '+23490126727',
      body: 'Hello',
      version: 'v4',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://v4.api.termii.com/api/sms/send',
    );
  });

  it('strips a trailing slash from custom baseUrl', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'ok', message_id: 99 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new TermiiSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
      baseUrl: 'https://custom.example/',
    });
    const result = await client.send({
      to: ['23490126727', '23480126727'],
      body: 'Hello',
    });
    expect(result.messageId).toBe('99');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://custom.example/api/sms/send',
    );
  });

  it('rejects version when baseUrl is set', async () => {
    const client = new TermiiSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
      baseUrl: 'https://custom.example',
    });
    await expect(
      client.send({
        to: '23490126727',
        body: 'Hello',
        version: 'v4',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects invalid phone numbers', async () => {
    const client = new TermiiSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
    });
    await expect(client.send({ to: '123', body: 'Hello' })).rejects.toThrow(
      /Invalid phone number/,
    );
  });

  it('maps non-JSON, failed code, and missing message_id to 502', async () => {
    const client = new TermiiSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('oops', { status: 500 })),
    );
    await expect(
      client.send({ to: '23490126727', body: 'Hello' }),
    ).rejects.toMatchObject({ status: 502 });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ code: 'error', message: 'nope' })),
    );
    await expect(
      client.send({ to: '23490126727', body: 'Hello' }),
    ).rejects.toMatchObject({ status: 502 });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 'ok' })),
    );
    await expect(
      client.send({ to: '23490126727', body: 'Hello' }),
    ).rejects.toThrow(/missing message_id/);
  });

  it('wraps fetch failures as 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const client = new TermiiSmsClient({
      type: 'termii',
      apiKey: 'termii-key',
      from: 'MyApp',
    });
    await expect(
      client.send({ to: '23490126727', body: 'Hello' }),
    ).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('Termii request failed'),
    });
  });
});
