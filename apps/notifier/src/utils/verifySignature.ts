import crypto from 'crypto';
import { logger } from './logger';

interface VerifySignatureOptions {
  payload: string;
  signature: string | null;
  secret: string;
  options?: {
    algorithm?: 'sha512' | 'sha256' | 'sha1' | 'md5';
    encoding?: 'hex' | 'base64';
  };
  tolerance?: number;
}
export function verifySignature(opts: VerifySignatureOptions): boolean {
  const { payload, signature, secret, tolerance = 300, options } = opts;
  const { algorithm = 'sha512', encoding = 'hex' } = options ?? {};

  if (!signature || !secret) {
    return false;
  }

  const parts = signature.split(',');
  let timestamp: number | null = null;
  let signatureValue: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatureValue = value;
    }
  }

  if (!timestamp || !signatureValue) {
    return false;
  }

  if (timestamp > 1e12) {
    logger.warn(
      { timestamp },
      'Timestamp appears to be in milliseconds, not seconds',
    );
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac(algorithm, secret)
    .update(`${timestamp.toString()}.`)
    .update(payload)
    .digest(encoding);

  const signatureBuf = Buffer.from(signatureValue, encoding);
  const expectedBuf = Buffer.from(expectedSignature, encoding);

  // timingSafeEqual throws if buffer lengths differ; treat as invalid signature.
  if (signatureBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuf, expectedBuf);
}
