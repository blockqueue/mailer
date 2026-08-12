import { sendSignedRequest } from './lib/notifier-client.js';

const BASE_URL = process.env.NOTIFIER_BASE_URL || 'http://localhost:3000';
const SECRET = process.env.NOTIFIER_SIGNING_SECRET || 'local-signing-secret';
const TO_EMAIL = process.env.TEST_TO_EMAIL || 'email@example.com';

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
};

const DEFAULT_CHOICE = '1';

function printUsage() {
  console.error('Usage: node scripts/send-welcome-mjml.js [--sample=1|2|3|4]');
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
