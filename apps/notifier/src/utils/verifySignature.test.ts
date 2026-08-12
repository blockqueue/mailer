import { afterEach, describe, expect, it, vi } from 'vitest';
import { signHmac } from '../../test/helpers/hmac';
import { verifySignature } from './verifySignature';

const SECRET = 'test-secret';
const BODY = '{"templateId":"welcome"}';

describe('verifySignature', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a valid signature', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const timestamp = Math.floor(Date.now() / 1000);
    expect(
      verifySignature({
        payload: BODY,
        signature: signHmac(SECRET, BODY, timestamp),
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it('rejects a missing signature or secret', () => {
    expect(
      verifySignature({
        payload: BODY,
        signature: null,
        secret: SECRET,
      }),
    ).toBe(false);
    expect(
      verifySignature({
        payload: BODY,
        signature: signHmac(SECRET, BODY),
        secret: '',
      }),
    ).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(
      verifySignature({
        payload: BODY,
        signature: 'not-a-signature',
        secret: SECRET,
      }),
    ).toBe(false);
    expect(
      verifySignature({
        payload: BODY,
        signature: 't=,v1=abc',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejects millisecond timestamps', () => {
    const ms = Date.now();
    expect(
      verifySignature({
        payload: BODY,
        signature: `t=${String(ms)},v1=abcd`,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejects an expired timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const timestamp = Math.floor(Date.now() / 1000) - 301;
    expect(
      verifySignature({
        payload: BODY,
        signature: signHmac(SECRET, BODY, timestamp),
        secret: SECRET,
        tolerance: 300,
      }),
    ).toBe(false);
  });

  it('accepts a timestamp within tolerance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const timestamp = Math.floor(Date.now() / 1000) - 299;
    expect(
      verifySignature({
        payload: BODY,
        signature: signHmac(SECRET, BODY, timestamp),
        secret: SECRET,
        tolerance: 300,
      }),
    ).toBe(true);
  });

  it('rejects a wrong secret', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const timestamp = Math.floor(Date.now() / 1000);
    expect(
      verifySignature({
        payload: BODY,
        signature: signHmac('other-secret', BODY, timestamp),
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejects a length-mismatched digest', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const timestamp = Math.floor(Date.now() / 1000);
    expect(
      verifySignature({
        payload: BODY,
        signature: `t=${String(timestamp)},v1=ab`,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('parses t=123=extra with parseInt stopping at =', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(123_000));
    const signature = signHmac(SECRET, BODY, 123).replace(
      't=123',
      't=123=extra',
    );
    expect(
      verifySignature({
        payload: BODY,
        signature,
        secret: SECRET,
      }),
    ).toBe(true);
  });
});
