import type { Context } from 'hono';
import { sendEmail } from '../services/mailer/send';
import { createTransport } from '../services/mailer/transport';
import { getRenderer } from '../services/renderer';
import type { GlobalConfig } from '../types/config';
import type { SendRequest, SendResponse } from '../types/request';
import type { TemplateLoader } from '../utils/loaders/template.loader';
import { validatePayload } from '../utils/validation/payload';

/**
 * Send email controller
 */
export async function sendEmailController(
  c: Context,
  body: SendRequest,
  config: GlobalConfig,
  templateLoader: TemplateLoader,
): Promise<Response> {
  try {
    // Validate required fields
    if (!body.templateId) {
      return c.json({ error: 'Missing required field: templateId' }, 400);
    }

    // Payload is required
    if (typeof body.payload !== 'object') {
      return c.json({ error: 'Missing required field: payload' }, 400);
    }

    // Load template
    const template = templateLoader.getTemplate(body.templateId);
    if (!template) {
      return c.json({ error: `Template not found: ${body.templateId}` }, 404);
    }

    // Validate payload against template schema
    const validation = validatePayload(template.schema, body.payload);
    if (!validation.valid) {
      return c.json(
        {
          error: 'Payload validation failed',
          details: validation.errors,
        },
        400,
      );
    }

    // Resolve account (request > template > global default)
    const accountId =
      body.account ?? template.account ?? config.defaults?.account;
    if (!accountId) {
      return c.json(
        { error: 'No account specified and no default account configured' },
        400,
      );
    }

    const accountConfig = config.accounts[accountId];
    // Runtime check (YAML parsing might not match types)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!accountConfig) {
      return c.json({ error: `Account not found: ${accountId}` }, 400);
    }

    // Resolve renderer (template > global default)
    const rendererType = template.renderer ?? config.defaults?.renderer;
    if (!rendererType) {
      return c.json({ error: 'No renderer specified' }, 400);
    }
    const renderer = getRenderer(rendererType);

    // Render email HTML
    const html = await renderer.render(template.templatePath, body.payload);

    // Create nodemailer transport
    const transport = createTransport(accountConfig);

    // Send email
    const result = await sendEmail(
      transport,
      html,
      body,
      template,
      accountConfig,
    );

    // Close transport connection
    transport.close();

    const response: SendResponse = {
      messageId: result.messageId,
      success: result.success,
    };

    return c.json(response);
  } catch (error: unknown) {
    console.error('Error processing send request:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      500,
    );
  }
}
