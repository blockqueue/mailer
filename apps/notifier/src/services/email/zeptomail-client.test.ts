import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, create } = vi.hoisted(() => {
  const post = vi.fn();
  return {
    post,
    create: vi.fn(() => ({ post })),
  };
});

vi.mock('axios', () => ({
  default: {
    create: (...args: unknown[]) => create(...args),
    isAxiosError: (error: unknown) =>
      Boolean(
        error &&
        typeof error === 'object' &&
        (error as { isAxiosError?: boolean }).isAxiosError,
      ),
  },
}));

import { EmailRequestError } from '../../utils/errors/request-error';
import { createEmailClient } from './createEmailClient';
import { ZeptomailEmailClient } from './zeptomail-client';

describe('ZeptomailEmailClient', () => {
  beforeEach(() => {
    post.mockReset();
    create.mockClear();
    post.mockResolvedValue({ data: { request_id: 'req-1' } });
  });

  it('posts the mapped payload and returns request_id', async () => {
    const client = createEmailClient({
      type: 'zeptomail',
      apiKey: 'zm-key',
      from: 'from@example.com',
      fromName: 'Account Name',
    });
    expect(client).toBeInstanceOf(ZeptomailEmailClient);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'zm-key' }),
      }),
    );

    const result = await client.send({
      from: 'From Name <from@example.com>',
      to: ['a@example.com', 'b@example.com'],
      subject: 'Hello',
      html: '<p>Hi</p>',
      cc: 'cc@example.com',
      replyTo: 'Reply <reply@example.com>',
      attachments: [
        {
          filename: 'note.txt',
          contentType: 'text/plain',
          content: Buffer.from('hello'),
        },
      ],
    });

    expect(result).toEqual({ messageId: 'req-1', success: true });
    expect(post).toHaveBeenCalledWith(
      '/email',
      expect.objectContaining({
        from: { address: 'from@example.com', name: 'Account Name' },
        to: [
          { email_address: { address: 'a@example.com' } },
          { email_address: { address: 'b@example.com' } },
        ],
        subject: 'Hello',
        htmlbody: '<p>Hi</p>',
        attachments: [
          expect.objectContaining({
            filename: 'note.txt',
            content: Buffer.from('hello').toString('base64'),
            content_type: 'text/plain',
          }),
        ],
      }),
    );
  });

  it('prefers request fromName over account fromName', async () => {
    const client = new ZeptomailEmailClient({
      type: 'zeptomail',
      apiKey: 'zm-key',
      from: 'from@example.com',
      fromName: 'Account',
    });
    await client.send({
      from: 'from@example.com',
      to: 'a@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      fromName: 'Request',
    });
    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        from: { address: 'from@example.com', name: 'Request' },
      }),
    );
  });

  it('throws 502 when request_id is missing', async () => {
    post.mockResolvedValue({ data: {} });
    const client = new ZeptomailEmailClient({
      type: 'zeptomail',
      apiKey: 'zm-key',
      from: 'from@example.com',
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
      message: 'Zeptomail response missing request_id',
    });
  });

  it('wraps axios errors', async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'network',
      response: { data: { error: { message: 'bad key' } } },
    });
    const client = new ZeptomailEmailClient({
      type: 'zeptomail',
      apiKey: 'zm-key',
      from: 'from@example.com',
    });
    await expect(
      client.send({
        from: 'from@example.com',
        to: 'a@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      }),
    ).rejects.toThrow('Zeptomail API error: bad key');
  });

  it('throws 400 when there are no recipients', async () => {
    const client = new ZeptomailEmailClient({
      type: 'zeptomail',
      apiKey: 'zm-key',
    });
    await expect(
      client.send({
        from: 'from@example.com',
        to: [],
        subject: 'Hello',
        html: '<p>Hi</p>',
      }),
    ).rejects.toBeInstanceOf(EmailRequestError);
  });
});
