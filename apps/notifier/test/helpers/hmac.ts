import crypto from 'node:crypto';

export function signHmac(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signature = crypto
    .createHmac('sha512', secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
