import type { Context } from 'hono';
import { createEmailClient } from '../services/mailer/createEmailClient';
import { sendEmail } from '../services/mailer/send';
import { getRenderer } from '../services/renderer';
import type { GlobalConfig } from '../types/config';
import type { SendRequest, SendResponse } from '../types/request';
import type { TemplateLoader } from '../utils/loaders/template.loader';
import { logger } from '../utils/logger';
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

    // Create email client
    const client = createEmailClient(accountConfig);

    // Send email
    const result = await sendEmail(client, html, body, template, accountConfig);

    // Close client connection
    await client.close();

    const response: SendResponse = {
      messageId: result.messageId,
      success: result.success,
    };

    return c.json(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        error: errorMessage,
        ...(errorStack && { stack: errorStack }),
      },
      'Error processing send request',
    );
    return c.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      500,
    );
  }
}
