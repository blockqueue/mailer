import { sendSignedRequest } from './lib/notifier-client.js';

const BASE_URL = process.env.NOTIFIER_BASE_URL || 'http://localhost:3000';
const SECRET = process.env.NOTIFIER_SIGNING_SECRET || 'local-signing-secret';
const TO_EMAIL = process.env.TEST_TO_EMAIL || 'email@example.com';

const ORDER_RECEIPT_PAYLOAD = {
  orderId: 'ORD-1001',
  customerName: 'Test User',
  appName: 'BlockQueue',
  lineItems: [
    { name: 'USB-C Hub', quantity: 1, price: '$49.00' },
    { name: 'Cable Pack', quantity: 2, price: '$24.00' },
  ],
  total: '$73.00',
  shippingAddress: '311 Zik Avenue, Awka, Anambra State, Nigeria',
  isGift: true,
  trackingUrl: 'https://blockqueue.io/orders/ORD-1001',
};

/** @type {Record<string, { label: string; templateId: string; subject: string; payload: Record<string, unknown> }>} */
const TEMPLATES = {
  1: {
    label: 'mjml-user-welcome (MJML)',
    templateId: 'mjml-user-welcome',
    subject: 'Welcome - test from script',
    payload: {
      userName: 'Test User',
      appName: 'BlockQueue',
      ctaUrl: 'https://blockqueue.io',
      supportEmail: 'support@blockqueue.io',
    },
  },
  2: {
    label: 'html-user-welcome (HTML)',
    templateId: 'html-user-welcome',
    subject: 'Welcome (HTML) - test from script',
    payload: {
      userName: 'Test User',
      appName: 'BlockQueue',
      supportEmail: 'support@blockqueue.io',
    },
  },
  3: {
    label: 'mjml-login-otp (MJML)',
    templateId: 'mjml-login-otp',
    subject: 'Your login code - test from script',
    payload: {
      userName: 'Test User',
      appName: 'BlockQueue',
      otpCode: '482913',
      expiresInMinutes: 10,
    },
  },
  4: {
    label: 'react-email-user-welcome (React Email)',
    templateId: 'react-email-user-welcome',
    subject: 'Welcome (React Email) - test from script',
    payload: {
      userName: 'Test User',
      appName: 'BlockQueue',
      ctaUrl: 'https://blockqueue.io',
    },
  },
  5: {
    label: 'mjml-order-receipt (MJML + Handlebars)',
    templateId: 'mjml-order-receipt',
    subject: 'Order ORD-1001 confirmed - test from script',
    payload: ORDER_RECEIPT_PAYLOAD,
  },
  6: {
    label: 'html-order-receipt (HTML + Handlebars)',
    templateId: 'html-order-receipt',
    subject: 'Order ORD-1001 confirmed (HTML) - test from script',
    payload: ORDER_RECEIPT_PAYLOAD,
  },
  7: {
    label: 'react-email-order-receipt (React Email)',
    templateId: 'react-email-order-receipt',
    subject: 'Order ORD-1001 confirmed (React Email) - test from script',
    payload: ORDER_RECEIPT_PAYLOAD,
  },
};

const DEFAULT_CHOICE = '1';

function printUsage() {
  console.error(
    'Usage: node scripts/send-welcome-mjml.js [--sample=1|2|3|4|5|6|7]',
  );
  console.error('');
  console.error('Templates:');
  for (const [key, template] of Object.entries(TEMPLATES)) {
    const marker = key === DEFAULT_CHOICE ? ' (default)' : '';
    console.error(`  ${key}  ${template.label}${marker}`);
  }
}

function resolveChoice(argv) {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  let choice;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--sample=')) {
      choice = arg.slice('--sample='.length);
      break;
    }
    if (arg === '--sample') {
      choice = args[i + 1];
      break;
    }
  }

  if (choice === undefined || choice === '') {
    return DEFAULT_CHOICE;
  }
  if (!(choice in TEMPLATES)) {
    console.error(`Error: unknown sample selection "${choice}"`);
    console.error('');
    printUsage();
    process.exit(1);
  }
  return choice;
}

async function main() {
  if (!SECRET) {
    console.error('Error: NOTIFIER_SIGNING_SECRET is required');
    process.exit(1);
  }

  const choice = resolveChoice(process.argv);
  const selected = TEMPLATES[choice];

  const body = {
    templateId: selected.templateId,
    payload: selected.payload,
    sendMailOptions: {
      to: TO_EMAIL,
      subject: selected.subject,
    },
  };

  console.log(`Sending template ${choice}: ${selected.label}`);
  await sendSignedRequest(BASE_URL, '/email/send', body, SECRET);
}

main();
