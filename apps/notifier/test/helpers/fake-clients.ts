import { vi } from 'vitest';
import type { SendResult } from '../../src/services/email/base-client';
import type { SmsSendResult } from '../../src/services/sms/base-client';

export function fakeEmailClient(result?: Partial<SendResult>) {
  return {
    send: vi.fn().mockResolvedValue({
      messageId: result?.messageId ?? 'email-msg-1',
      success: result?.success ?? true,
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

export function fakeSmsClient(result?: Partial<SmsSendResult>) {
  return {
    send: vi.fn().mockResolvedValue({
      messageId: result?.messageId ?? 'sms-msg-1',
      success: result?.success ?? true,
    }),
  };
}
