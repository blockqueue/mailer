import { sendSignedRequest } from './lib/notifier-client.js';

const BASE_URL = process.env.NOTIFIER_BASE_URL || 'http://localhost:3000';
const SECRET = process.env.NOTIFIER_SIGNING_SECRET;
const TO_EMAIL = process.env.TEST_TO_EMAIL || 'email@example.com';

const body = {
  templateId: 'mjml-user-welcome',
  payload: {
    userName: 'Test User',
    appName: 'BlockQueue',
    ctaUrl: 'https://blockqueue.io',
    supportEmail: 'support@blockqueue.io',
  },
  sendMailOptions: {
    to: TO_EMAIL,
    subject: 'Welcome - test from script',
  },
};

async function main() {
  if (!SECRET) {
    console.error('Error: NOTIFIER_SIGNING_SECRET is required');
    process.exit(1);
  }

  await sendSignedRequest(BASE_URL, '/email/send', body, SECRET);
}

main();
