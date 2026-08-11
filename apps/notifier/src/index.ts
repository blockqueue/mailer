import 'dotenv/config';

import { serve } from '@hono/node-server';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { sendEmailController } from './controllers/email.controller';
import { sendSmsController } from './controllers/sms.controller';
import { auditLogMiddleware } from './middleware/auditLog';
import { authMiddleware } from './middleware/auth';
import { requestValidationMiddleware } from './middleware/requestValidation';
import type { SendEmailRequest, SendSmsRequest } from './types/request';
import { loadConfig } from './utils/loaders/config.loader';
import { TemplateLoader } from './utils/loaders/template.loader';
import { logger } from './utils/logger';

function getParsedBody(c: Context): unknown {
  return (c as unknown as { get: (key: string) => unknown }).get('parsedBody');
}

const app = new Hono();

let config: ReturnType<typeof loadConfig>;
let templateLoader: TemplateLoader;

try {
  config = loadConfig();
  logger.info('Configuration loaded successfully');

  templateLoader = new TemplateLoader(config.email?.defaults?.renderer);

  const emailConfigured =
    Boolean(config.email?.accounts) &&
    Object.keys(config.email?.accounts ?? {}).length > 0;

  if (emailConfigured) {
    const loadResult = templateLoader.loadAllTemplates();

    if (loadResult.successCount === 0 && loadResult.failureCount > 0) {
      logger.error(
        {
          failureCount: loadResult.failureCount,
          failures: loadResult.failures,
        },
        'No templates loaded successfully. Server will start but email sending will fail.',
      );
    }
  } else {
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

app.post('/email/send', authMiddleware(config), async (c) => {
  const body = getParsedBody(c) as SendEmailRequest | undefined;
  if (!body) {
    return c.json(
      { success: false, message: 'Request body not available' },
      500,
    );
  }
  return sendEmailController(c, body, config, templateLoader);
});

app.post('/sms/send', authMiddleware(config), async (c) => {
  const body = getParsedBody(c) as SendSmsRequest | undefined;
  if (!body) {
    return c.json(
      { success: false, message: 'Request body not available' },
      500,
    );
  }
  return sendSmsController(c, body, config);
});

serve({
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
});
