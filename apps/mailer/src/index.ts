import { Hono } from 'hono';
import { sendEmailController } from './controllers/email.controller';
import { authMiddleware } from './middleware/auth';
import type { SendRequest } from './types/request';
import { loadConfig } from './utils/loaders/config.loader';
import { TemplateLoader } from './utils/loaders/template.loader';

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

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/send', authMiddleware(config), async (c) => {
  const body: SendRequest = await c.req.json();
  return sendEmailController(c, body, config, templateLoader);
});

export default app;
