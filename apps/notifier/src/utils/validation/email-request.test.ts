import { describe, expect, it } from 'vitest';
import type { SendEmailRequest } from '../../types/request';
import { EmailRequestError } from '../errors/request-error';
import { validateEmailRequestFields } from './email-request';

function body(
  sendMailOptions?: SendEmailRequest['sendMailOptions'],
): SendEmailRequest {
  return {
    templateId: 'welcome',
    payload: {},
    sendMailOptions,
  };
}

describe('validateEmailRequestFields', () => {
  it('allows omitted sendMailOptions', () => {
    expect(() => validateEmailRequestFields(body())).not.toThrow();
  });

  it('rejects unknown sendMailOptions keys', () => {
    expect(() =>
      validateEmailRequestFields(
        body({ to: 'a@example.com', extra: true } as never),
      ),
    ).toThrow(/Unknown sendMailOptions field\(s\): extra/);
  });

  it('rejects Zeptomail-only fields on SES accounts', () => {
    expect(() =>
      validateEmailRequestFields(body({ fromName: 'Ada' }), {
        type: 'ses',
        region: 'us-east-1',
        accessKeyId: 'id',
        secretAccessKey: 'secret',
      }),
    ).toThrow(/only supported for Zeptomail accounts/);
  });

  it('allows Zeptomail-only fields on Zeptomail accounts', () => {
    expect(() =>
      validateEmailRequestFields(body({ fromName: 'Ada' }), {
        type: 'zeptomail',
        apiKey: 'key',
      }),
    ).not.toThrow();
  });

  it('rejects empty strings and empty address lists', () => {
    expect(() => validateEmailRequestFields(body({ from: '  ' }))).toThrow(
      EmailRequestError,
    );
    expect(() => validateEmailRequestFields(body({ to: [] }))).toThrow(
      EmailRequestError,
    );
    expect(() => validateEmailRequestFields(body({ cc: [''] }))).toThrow(
      EmailRequestError,
    );
  });

  it('rejects sendMailOptions that are not an object', () => {
    expect(() =>
      validateEmailRequestFields({
        templateId: 'welcome',
        payload: {},
        sendMailOptions: [] as never,
      }),
    ).toThrow('Field sendMailOptions must be an object');
  });

  it('rejects attachments that are not an array', () => {
    expect(() =>
      validateEmailRequestFields(
        body({ attachments: 'file' as unknown as never[] }),
      ),
    ).toThrow(/attachments \(must be an array\)/);
  });
});
