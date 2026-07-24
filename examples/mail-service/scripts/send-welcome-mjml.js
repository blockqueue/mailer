/**
 * Send a test email via welcome-mjml-email (mail-service on :3000).
 * Usage: MAILER_SIGNING_SECRET=… node examples/mail-service/scripts/send-welcome-mjml.js
 * Optional: MAILER_BASE_URL, TEST_TO_EMAIL
 */

const crypto = require('crypto');

const BASE_URL = process.env.MAILER_BASE_URL || 'http://localhost:3000';
const SECRET =
  process.env.MAILER_SIGNING_SECRET ||
  'wefeqfdwfwrfqfweq9343rrwfeafeqr42r432ef';
const TO_EMAIL = process.env.TEST_TO_EMAIL || 'email@example.com';

const body = {
  templateId: 'welcome-mjml-email',
  payload: {
    userName: 'Test User',
    appName: 'Blockqueue Mailer',
  },
  sendMailOptions: {
    to: TO_EMAIL,
    subject: 'Welcome - test from script',
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
  return { timestamp, signature: `t=${timestamp},v1=${signature}` };
}

async function main() {
  if (!SECRET) {
    console.error('Error: MAILER_SIGNING_SECRET is required');
    process.exit(1);
  }

  const payloadStr = JSON.stringify(body);
  const { signature } = computeSignature(payloadStr, SECRET);

  const url = `${BASE_URL.replace(/\/$/, '')}/send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mailer-signature': signature,
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
