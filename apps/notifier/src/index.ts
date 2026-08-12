import 'dotenv/config';

import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getErrorMessage } from './utils/errors/error-details';
import { loadConfig } from './utils/loaders/config.loader';
import { TemplateLoader } from './utils/loaders/template.loader';
import { logger } from './utils/logger';
import { validateAccountReferences } from './utils/validateAccountRefs';

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
  const errorMessage = getErrorMessage(error);
  logger.error({ error: errorMessage }, 'Failed to initialize');
  throw new Error(`Failed to initialize: ${errorMessage}`);
}

const app = createApp(config, templateLoader);

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    `Invalid PORT "${process.env.PORT ?? ''}": must be an integer between 1 and 65535`,
  );
}
logger.info({ port }, 'Notifier server listening');
serve({
  port,
  fetch: app.fetch,
});
