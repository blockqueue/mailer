import { Hono } from 'hono';
import { sendEmailController } from './controllers/email.controller';
import { sendSmsController } from './controllers/sms.controller';
import { auditLogMiddleware } from './middleware/auditLog';
import { authMiddleware } from './middleware/auth';
import { requestValidationMiddleware } from './middleware/requestValidation';
import type { GlobalConfig } from './types/config';
import type { AppEnv } from './types/hono';
import type { SendEmailRequest, SendSmsRequest } from './types/request';
import { requireParsedBody } from './utils/http/require-parsed-body';
import type { TemplateLoader } from './utils/loaders/template.loader';

export function createApp(
  config: GlobalConfig,
  templateLoader: TemplateLoader,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const emailConfigured =
    Boolean(config.email?.accounts) &&
    Object.keys(config.email?.accounts ?? {}).length > 0;

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
    const parsed = requireParsedBody(c);
    if (!parsed.ok) {
      return parsed.response;
    }
    return sendEmailController(
      c,
      parsed.value as SendEmailRequest,
      config,
      templateLoader,
    );
  });

  app.post('/sms/send', authMiddleware(config), async (c) => {
    const parsed = requireParsedBody(c);
    if (!parsed.ok) {
      return parsed.response;
    }
    return sendSmsController(c, parsed.value as SendSmsRequest, config);
  });

  return app;
}
