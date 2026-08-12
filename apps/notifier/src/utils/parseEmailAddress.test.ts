import { describe, expect, it } from 'vitest';
import { parseEmailAddress } from './parseEmailAddress';

describe('parseEmailAddress', () => {
  it('returns a plain address', () => {
    expect(parseEmailAddress('user@example.com')).toEqual({
      address: 'user@example.com',
    });
  });

  it('parses a display name', () => {
    expect(parseEmailAddress('Jane Doe <jane@example.com>')).toEqual({
      name: 'Jane Doe',
      address: 'jane@example.com',
    });
  });

  it('trims whitespace', () => {
    expect(parseEmailAddress('  user@example.com  ')).toEqual({
      address: 'user@example.com',
    });
  });

  it('rejects nested angle brackets', () => {
    expect(parseEmailAddress('Name <a<b>@example.com>')).toEqual({
      address: 'Name <a<b>@example.com>',
    });
  });

  it('treats an empty display name as a plain address', () => {
    expect(parseEmailAddress(' <user@example.com>')).toEqual({
      address: '<user@example.com>',
    });
  });
});
