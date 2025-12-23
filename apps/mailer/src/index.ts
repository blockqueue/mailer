import type { Context } from 'hono';
import { Hono } from 'hono';
import { sendEmailController } from './controllers/email.controller';
import { auditLogMiddleware } from './middleware/auditLog';
import { authMiddleware } from './middleware/auth';
import { httpsEnforcementMiddleware } from './middleware/httpsEnforcement';
import { ipAllowlistMiddleware } from './middleware/ipAllowlist';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { requestValidationMiddleware } from './middleware/requestValidation';
import type { SendRequest } from './types/request';
import { loadConfig } from './utils/loaders/config.loader';
import { TemplateLoader } from './utils/loaders/template.loader';

/**
 * Helper to get parsed body from context (set by request validation middleware)
 */
function getParsedBody(c: Context): SendRequest | undefined {
  // Hono's context.get() doesn't support custom keys in its type system
  // We use a type assertion to access the custom 'parsedBody' variable
  // This is set by request validation middleware for POST requests
  return (c as unknown as { get: (key: string) => unknown }).get(
    'parsedBody',
  ) as SendRequest | undefined;
}

const app = new Hono();

// Load configuration at startup
let config: ReturnType<typeof loadConfig>;
let templateLoader: TemplateLoader;

try {
  config = loadConfig();
  console.log('Configuration loaded successfully');

  templateLoader = new TemplateLoader();
  templateLoader.loadAllTemplates();
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Failed to initialize:', errorMessage);
  throw new Error(`Failed to initialize: ${errorMessage}`);
}

// Apply middleware in order:
// 1. HTTPS enforcement (always)
app.use('*', httpsEnforcementMiddleware());

// 2. IP allowlisting (if enabled, before auth)
app.use('*', ipAllowlistMiddleware(config));

// 3. Request validation (always)
app.use('*', requestValidationMiddleware(config));

// 4. Rate limiting (if enabled, skip for /health)
app.use('/send', rateLimitMiddleware(config));

// 5. Audit logging (always)
app.use('*', auditLogMiddleware());

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// 6. Authentication (always for /send)
app.post('/send', authMiddleware(config), async (c) => {
  // Body is already parsed by request validation middleware
  const body = getParsedBody(c);
  if (!body) {
    return c.json({ error: 'Request body not available' }, 500);
  }
  return sendEmailController(c, body, config, templateLoader);
});

export default {
  port: process.env.PORT ?? 3000,
  fetch: app.fetch,
};
