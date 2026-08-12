import { describe, expect, it } from 'vitest';
import { fakeSmsClient } from '../../../test/helpers/fake-clients';
import { sendSms } from './send';
import type { TermiiSmsClient } from './termii-client';

describe('sendSms', () => {
  it('passes request overrides through to the client', async () => {
    const client = fakeSmsClient();
    await sendSms(
      client as unknown as TermiiSmsClient,
      {
        to: '23490126727',
        body: 'Hello',
        sendOptions: {
          from: 'Override',
          version: 'v4',
          channel: 'dnd',
          messageType: 'unicode',
        },
      },
      {
        type: 'termii',
        apiKey: 'key',
        from: 'Account',
        version: 'v3',
      },
    );

    expect(client.send).toHaveBeenCalledWith({
      to: '23490126727',
      body: 'Hello',
      from: 'Override',
      version: 'v4',
      channel: 'dnd',
      messageType: 'unicode',
    });
  });

  it('falls back to the account from', async () => {
    const client = fakeSmsClient();
    await sendSms(
      client as unknown as TermiiSmsClient,
      { to: '23490126727', body: 'Hello' },
      { type: 'termii', apiKey: 'key', from: 'Account' },
    );
    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Account' }),
    );
  });
});
