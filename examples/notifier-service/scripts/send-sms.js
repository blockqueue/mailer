const crypto = require('crypto');

const BASE_URL = process.env.NOTIFIER_BASE_URL || 'http://localhost:3000';
const SECRET =
  process.env.NOTIFIER_SIGNING_SECRET ||
  'wefeqfdwfwrfqfweq9343rrwfeafeqr42r432ef';
const TO = process.env.TERMII_TO || '23490126727';
const VERSION = process.env.TERMII_API_VERSION || 'v3';

const body = {
  to: TO,
  body: 'Hello from BlockQueue Notifier',
  sendOptions: {
    version: VERSION,
    channel: 'dnd',
    messageType: 'plain',
  },
};

function computeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadStr =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  const toSign = `${timestamp}.${payloadStr}`;
  const signature = crypto
    .createHmac('sha512', secret)
    .update(toSign)
    .digest('hex');
  return { signature: `t=${timestamp},v1=${signature}` };
}

async function main() {
  const payloadStr = JSON.stringify(body);
  const { signature } = computeSignature(payloadStr, SECRET);

  const url = `${BASE_URL.replace(/\/$/, '')}/sms/send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-notifier-signature': signature,
    },
    body: payloadStr,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Request failed:', res.status, data);
    process.exit(1);
  }
  console.log('Success:', data);
}

main();
