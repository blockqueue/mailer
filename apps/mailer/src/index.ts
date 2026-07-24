import 'dotenv/config';

import { serve } from '@hono/node-server';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { sendEmailController } from './controllers/email.controller';
import { auditLogMiddleware } from './middleware/auditLog';
import { authMiddleware } from './middleware/auth';
import { httpsEnforcementMiddleware } from './middleware/httpsEnforcement';
import { requestValidationMiddleware } from './middleware/requestValidation';
import type { SendRequest } from './types/request';
import { loadConfig } from './utils/loaders/config.loader';
import { TemplateLoader } from './utils/loaders/template.loader';
import { logger } from './utils/logger';

function getParsedBody(c: Context): SendRequest | undefined {
  // Hono's context.get() doesn't type custom keys; assertion for 'parsedBody'
  return (c as unknown as { get: (key: string) => unknown }).get(
    'parsedBody',
  ) as SendRequest | undefined;
}

const app = new Hono();

let config: ReturnType<typeof loadConfig>;
let templateLoader: TemplateLoader;

try {
  config = loadConfig();
  logger.info('Configuration loaded successfully');

  templateLoader = new TemplateLoader(config.defaults?.renderer);
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
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error: errorMessage }, 'Failed to initialize');
  throw new Error(`Failed to initialize: ${errorMessage}`);
}

app.use('*', httpsEnforcementMiddleware());
app.use('*', requestValidationMiddleware(config));
app.use('*', auditLogMiddleware());

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/send', authMiddleware(config), async (c) => {
  const body = getParsedBody(c);
  if (!body) {
    return c.json(
      { success: false, message: 'Request body not available' },
      500,
    );
  }
  return sendEmailController(c, body, config, templateLoader);
});

serve({
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
});
