import crypto from 'crypto';

interface VerifySignatureOptions {
  payload: string;
  signature: string | null;
  secret: string;
  options?: {
    algorithm?: 'sha512' | 'sha256' | 'sha1' | 'md5';
    encoding?: 'hex' | 'base64';
  };
  tolerance?: number; // in seconds, default 300 (5 minutes)
}
export function verifySignature(opts: VerifySignatureOptions): boolean {
  const { payload, signature, secret, tolerance = 300, options } = opts;
  const { algorithm = 'sha512', encoding = 'hex' } = options ?? {};

  if (!signature || !secret) return false;

  // Parse the signature header: "t=<timestamp>,v1=<signature>"
  const parts = signature.split(',');
  let timestamp: number | null = null;
  let signatureValue: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatureValue = value;
    }
  }

  if (!timestamp || !signatureValue) return false;

  // Check timestamp tolerance (optional but recommended)
  // Timestamp is in milliseconds (Date.now()), tolerance is in seconds
  const now = Date.now();
  const toleranceMs = tolerance * 1000; // Convert seconds to milliseconds
  if (Math.abs(now - timestamp) > toleranceMs) {
    return false; // Signature too old or from future
  }

  // Compute signature: HMAC-SHA512(timestamp + "." + payload, secret)
  // Note: timestamp should be in milliseconds (e.g., Date.now())
  const expectedSignature = crypto
    .createHmac(algorithm, secret)
    .update(`${timestamp.toString()}.`)
    .update(payload)
    .digest(encoding);

  // Compare signatures using timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signatureValue, encoding),
    Buffer.from(expectedSignature, encoding),
  );
}
