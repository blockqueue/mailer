import { describe, expect, it } from 'vitest';
import { createSmsClient } from './createSmsClient';

describe('createSmsClient', () => {
  it('rejects an unknown SMS type', () => {
    expect(() =>
      createSmsClient({ type: 'twilio', apiKey: 'key' } as never),
    ).toThrow(/unsupported type: twilio/);
  });
});
