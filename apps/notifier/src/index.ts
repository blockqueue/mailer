import 'dotenv/config';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { sendEmailController } from './controllers/email.controller';
import { sendSmsController } from './controllers/sms.controller';
import { auditLogMiddleware } from './middleware/auditLog';
import { authMiddleware } from './middleware/auth';
import { requestValidationMiddleware } from './middleware/requestValidation';
import type { SendEmailRequest, SendSmsRequest } from './types/request';
import type { AppEnv } from './types/hono';
import { loadConfig } from './utils/loaders/config.loader';
import { TemplateLoader } from './utils/loaders/template.loader';
import { logger } from './utils/logger';
import { validateAccountReferences } from './utils/validateAccountRefs';

const app = new Hono<AppEnv>();

let config: ReturnType<typeof loadConfig>;
let templateLoader: TemplateLoader;
let emailConfigured = false;

try {
  config = loadConfig();
  logger.info('Configuration loaded successfully');

  templateLoader = new TemplateLoader(config.email?.defaults?.renderer);

  emailConfigured =
    Boolean(config.email?.accounts) &&
    Object.keys(config.email?.accounts ?? {}).length > 0;

  if (emailConfigured) {
    const loadResult = templateLoader.loadAllTemplates();

    if (loadResult.successCount === 0) {
      logger.error(
        {
          failureCount: loadResult.failureCount,
          failures: loadResult.failures,
        },
        'No email templates loaded. Email sending cannot work.',
      );
      throw new Error('Failed to load email templates');
    }

    if (loadResult.failureCount > 0) {
      const summary = loadResult.failures
        .map((f) => `${f.templateId}: ${f.error}`)
        .join('; ');
      throw new Error(`Failed to load email templates: ${summary}`);
    }

    validateAccountReferences(config, templateLoader);
  } else {
    validateAccountReferences(config);
    logger.info('Email channel not configured; skipping template load');
  }
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error: errorMessage }, 'Failed to initialize');
  throw new Error(`Failed to initialize: ${errorMessage}`);
}

app.use('*', requestValidationMiddleware(config));
app.use('*', auditLogMiddleware());

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.get('/ready', (c) => {
  if (emailConfigured && templateLoader.getTemplateIds().length === 0) {
    return c.json(
      { status: 'not_ready', message: 'No email templates loaded' },
      503,
    );
  }
  return c.json({ status: 'ok' });
});

app.post('/email/send', authMiddleware(config), async (c) => {
  const body = c.get('parsedBody') as unknown as SendEmailRequest | undefined;
  if (!body) {
    return c.json(
      { success: false, message: 'Request body not available' },
      500,
    );
  }
  return sendEmailController(c, body, config, templateLoader);
});

app.post('/sms/send', authMiddleware(config), async (c) => {
  const body = c.get('parsedBody') as unknown as SendSmsRequest | undefined;
  if (!body) {
    return c.json(
      { success: false, message: 'Request body not available' },
      500,
    );
  }
  return sendSmsController(c, body, config);
});

const port = Number(process.env.PORT ?? 3000);
logger.info({ port }, 'Notifier server listening');
serve({
  port,
  fetch: app.fetch,
});
