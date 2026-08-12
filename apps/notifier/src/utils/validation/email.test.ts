import { describe, expect, it } from 'vitest';
import { EmailRequestError } from '../errors/request-error';
import { validateEmailAddresses } from './email';

describe('validateEmailAddresses', () => {
  it('returns invalid addresses', () => {
    expect(validateEmailAddresses('not-an-email', 'to')).toEqual([
      'not-an-email',
    ]);
    expect(validateEmailAddresses(['ok@example.com', 'bad'], 'to')).toEqual([
      'bad',
    ]);
  });

  it('accepts a display-name address', () => {
    expect(validateEmailAddresses('Ada <ada@example.com>', 'from')).toEqual([]);
  });

  it('throws when a required field is missing', () => {
    expect(() => validateEmailAddresses(undefined, 'to', true)).toThrow(
      EmailRequestError,
    );
    expect(() => validateEmailAddresses(undefined, 'from', true)).toThrow(
      /Provide it in request.sendMailOptions, template.from, or account.from/,
    );
  });

  it('returns an empty list for optional missing fields', () => {
    expect(validateEmailAddresses(undefined, 'cc')).toEqual([]);
  });

  it('flags non-string entries', () => {
    expect(validateEmailAddresses([123 as unknown as string], 'to')).toEqual([
      '123',
    ]);
  });
});
