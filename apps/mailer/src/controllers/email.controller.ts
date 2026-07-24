import type { Context } from 'hono';
import { createEmailClient } from '../services/mailer/createEmailClient';
import { sendEmail } from '../services/mailer/send';
import { getRenderer } from '../services/renderer';
import type { GlobalConfig } from '../types/config';
import type { SendRequest, SendResponse } from '../types/request';
import type { TemplateLoader } from '../utils/loaders/template.loader';
import { logger } from '../utils/logger';
import { validatePayload } from '../utils/validation/payload';

export async function sendEmailController(
  c: Context,
  body: SendRequest,
  config: GlobalConfig,
  templateLoader: TemplateLoader,
): Promise<Response> {
  try {
    if (!body.templateId) {
      return c.json(
        { success: false, message: 'Missing required field: templateId' },
        400,
      );
    }

    if (typeof body.payload !== 'object') {
      return c.json(
        { success: false, message: 'Missing required field: payload' },
        400,
      );
    }

    const template = templateLoader.getTemplate(body.templateId);
    if (!template) {
      return c.json(
        {
          success: false,
          message: `Template not found: ${body.templateId}`,
        },
        404,
      );
    }

    const validation = validatePayload(template.schema, body.payload);
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          message: 'Payload validation failed',
          details: validation.errors,
        },
        400,
      );
    }

    // Resolve account: request > template > global default
    const accountId =
      body.account ?? template.account ?? config.defaults?.account;
    if (!accountId) {
      return c.json(
        {
          success: false,
          message:
            'No account specified and no default account configured',
        },
        400,
      );
    }

    const accountConfig = config.accounts[accountId];
    // Runtime check (YAML parsing might not match types)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!accountConfig) {
      return c.json(
        { success: false, message: `Account not found: ${accountId}` },
        400,
      );
    }

    // Resolve renderer: template > global default
    const rendererType = template.renderer ?? config.defaults?.renderer;
    if (!rendererType) {
      return c.json(
        { success: false, message: 'No renderer specified' },
        400,
      );
    }
    const renderer = getRenderer(rendererType);

    const html = await renderer.render(template.templatePath, body.payload);

    const client = createEmailClient(accountConfig);

    const result = await sendEmail(client, html, body, template, accountConfig);

    await client.close();

    const response: SendResponse = {
      success: true,
      messageId: result.messageId,
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
        success: false,
        message: errorMessage,
      },
      500,
    );
  }
}
