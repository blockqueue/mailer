const { sendSignedRequest } = require('./lib/notifier-client');

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

async function main() {
  await sendSignedRequest(BASE_URL, '/sms/send', body, SECRET);
}

main();
