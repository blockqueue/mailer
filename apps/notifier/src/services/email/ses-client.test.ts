import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send, destroy } = vi.hoisted(() => ({
  send: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    send = send;
    destroy = destroy;
  },
  SendRawEmailCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock('aws-sdk-v3-proxy', () => ({
  addProxyToClient: <T>(client: T) => client,
}));

import { createEmailClient } from './createEmailClient';
import { SesEmailClient } from './ses-client';

describe('SesEmailClient', () => {
  beforeEach(() => {
    send.mockReset();
    destroy.mockReset();
    send.mockResolvedValue({ MessageId: 'ses-1' });
  });

  it('sends a raw message and returns MessageId', async () => {
    const client = createEmailClient({
      type: 'ses',
      region: 'us-east-1',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      from: 'from@example.com',
    });
    expect(client).toBeInstanceOf(SesEmailClient);

    const result = await client.send({
      from: 'from@example.com',
      to: 'a@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      attachments: [
        {
          filename: 'note.txt',
          contentType: 'text/plain',
          content: 'aGVsbG8=',
        },
      ],
    });

    expect(result).toEqual({ messageId: 'ses-1', success: true });
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0] as {
      input: { RawMessage: { Data: Buffer } };
    };
    const raw = Buffer.from(command.input.RawMessage.Data).toString();
    expect(raw).toContain('Hello');
    expect(raw).toContain('<p>Hi</p>');
  });

  it('throws 502 when MessageId is missing', async () => {
    send.mockResolvedValue({});
    const client = new SesEmailClient({
      type: 'ses',
      region: 'us-east-1',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
    });
    await expect(
      client.send({
        from: 'from@example.com',
        to: 'a@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      }),
    ).rejects.toMatchObject({
      status: 502,
      message: 'SES response missing MessageId',
    });
  });

  it('destroys the SES client on close', async () => {
    const client = new SesEmailClient({
      type: 'ses',
      region: 'us-east-1',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
    });
    await client.close();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
