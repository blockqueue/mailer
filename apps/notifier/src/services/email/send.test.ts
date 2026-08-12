import { describe, expect, it } from 'vitest';
import { fakeEmailClient } from '../../../test/helpers/fake-clients';
import type { TemplateConfig } from '../../types/template';
import { EmailRequestError } from '../../utils/errors/request-error';
import { sendEmail } from './send';
import type { SesEmailClient } from './ses-client';
import type { ZeptomailEmailClient } from './zeptomail-client';

const template: TemplateConfig = {
  id: 'welcome',
  renderer: 'html',
  from: 'template@example.com',
  subject: 'Template subject',
  schema: { type: 'object' },
};

const zeptomailAccount = {
  type: 'zeptomail' as const,
  from: 'account@example.com',
  fromName: 'Account',
  apiKey: 'key',
  bounceAddress: 'bounce@example.com',
};

const sesAccount = {
  type: 'ses' as const,
  from: 'ses@example.com',
  region: 'us-east-1',
  accessKeyId: 'id',
  secretAccessKey: 'secret',
};

describe('sendEmail', () => {
  it('prefers request over template over account', async () => {
    const client = fakeEmailClient();
    await sendEmail(
      client as unknown as ZeptomailEmailClient,
      '<p>Hi</p>',
      {
        templateId: 'welcome',
        payload: {},
        sendMailOptions: {
          from: 'request@example.com',
          to: 'user@example.com',
          subject: 'Request subject',
          fromName: 'Request',
        },
      },
      template,
      zeptomailAccount,
    );

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'request@example.com',
        to: 'user@example.com',
        subject: 'Request subject',
        html: '<p>Hi</p>',
        fromName: 'Request',
      }),
    );
  });

  it('skips empty request values and falls through', async () => {
    const client = fakeEmailClient();
    await sendEmail(
      client as unknown as ZeptomailEmailClient,
      '<p>Hi</p>',
      {
        templateId: 'welcome',
        payload: {},
        sendMailOptions: {
          from: '  ',
          to: 'user@example.com',
        },
      },
      template,
      zeptomailAccount,
    );

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'template@example.com',
        subject: 'Template subject',
      }),
    );
  });

  it('does not pass Zeptomail-only fields to SES', async () => {
    const client = fakeEmailClient();
    await sendEmail(
      client as unknown as SesEmailClient,
      '<p>Hi</p>',
      {
        templateId: 'welcome',
        payload: {},
        sendMailOptions: {
          to: 'user@example.com',
          fromName: 'Nope',
        },
      },
      template,
      sesAccount,
    );

    const options = client.send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.fromName).toBeUndefined();
    expect(options.bounceAddress).toBeUndefined();
  });

  it('throws 400 when from, to, or subject is missing', async () => {
    const client = fakeEmailClient();
    await expect(
      sendEmail(
        client as unknown as ZeptomailEmailClient,
        '<p>Hi</p>',
        { templateId: 'welcome', payload: {} },
        { id: 'welcome', schema: { type: 'object' } },
        { type: 'zeptomail', apiKey: 'key' },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('throws 400 for invalid emails', async () => {
    const client = fakeEmailClient();
    await expect(
      sendEmail(
        client as unknown as ZeptomailEmailClient,
        '<p>Hi</p>',
        {
          templateId: 'welcome',
          payload: {},
          sendMailOptions: {
            to: 'not-an-email',
            from: 'from@example.com',
            subject: 'Hi',
          },
        },
        { id: 'welcome', schema: { type: 'object' } },
        zeptomailAccount,
      ),
    ).rejects.toBeInstanceOf(EmailRequestError);
  });

  it('wraps provider failures as 502', async () => {
    const client = fakeEmailClient();
    client.send.mockRejectedValue(new Error('upstream down'));
    await expect(
      sendEmail(
        client as unknown as ZeptomailEmailClient,
        '<p>Hi</p>',
        {
          templateId: 'welcome',
          payload: {},
          sendMailOptions: {
            to: 'user@example.com',
            from: 'from@example.com',
            subject: 'Hi',
          },
        },
        { id: 'welcome', schema: { type: 'object' } },
        zeptomailAccount,
      ),
    ).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('Failed to send email'),
    });
  });

  it('returns the provider messageId', async () => {
    const client = fakeEmailClient({ messageId: 'zm-1' });
    const result = await sendEmail(
      client as unknown as ZeptomailEmailClient,
      '<p>Hi</p>',
      {
        templateId: 'welcome',
        payload: {},
        sendMailOptions: {
          to: 'user@example.com',
          from: 'from@example.com',
          subject: 'Hi',
        },
      },
      { id: 'welcome', schema: { type: 'object' } },
      zeptomailAccount,
    );
    expect(result).toEqual({ messageId: 'zm-1', success: true });
  });
});
