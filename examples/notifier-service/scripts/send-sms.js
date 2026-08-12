import { sendSignedRequest } from './lib/notifier-client.js';

const BASE_URL = process.env.NOTIFIER_BASE_URL || 'http://localhost:3000';
const SECRET = process.env.NOTIFIER_SIGNING_SECRET || 'local-signing-secret';
const TO = process.env.TERMII_TO || '2347012345678';
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

async function main() {
  if (!SECRET) {
    console.error('Error: NOTIFIER_SIGNING_SECRET is required');
    process.exit(1);
  }

  await sendSignedRequest(BASE_URL, '/sms/send', body, SECRET);
}

main();
