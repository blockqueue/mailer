import type { Context } from 'hono';
import { createEmailClient } from '../services/email/createEmailClient';
import { sendEmail } from '../services/email/send';
import { getRenderer } from '../services/renderer';
import type { GlobalConfig } from '../types/config';
import type { SendEmailRequest, SendResponse } from '../types/request';
import type { TemplateLoader } from '../utils/loaders/template.loader';
import { validatePayload } from '../utils/validation/payload';
import { handleChannelError } from './handle-channel-error';

export async function sendEmailController(
  c: Context,
  body: SendEmailRequest,
  config: GlobalConfig,
  templateLoader: TemplateLoader,
): Promise<Response> {
  let client: ReturnType<typeof createEmailClient> | undefined;
  try {
    if (!config.email?.accounts) {
      return c.json(
        { success: false, message: 'Email channel is not configured' },
        503,
      );
    }

    if (!body.templateId) {
      return c.json(
        { success: false, message: 'Missing required field: templateId' },
        400,
      );
    }

    if (
      body.payload === null ||
      typeof body.payload !== 'object' ||
      Array.isArray(body.payload)
    ) {
      return c.json(
        {
          success: false,
          message: 'Missing or invalid field: payload (must be an object)',
        },
        400,
      );
    }

    const payload = body.payload as Record<string, unknown>;

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

    const validation = validatePayload(template.schema, payload);
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

    const accountId =
      body.account ?? template.account ?? config.email.defaults?.account;
    if (!accountId) {
      return c.json(
        {
          success: false,
          message:
            'No account specified and no default email account configured',
        },
        400,
      );
    }

    const accountConfig = config.email.accounts[accountId];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!accountConfig) {
      return c.json(
        { success: false, message: `Email account not found: ${accountId}` },
        400,
      );
    }

    const rendererType = template.renderer ?? config.email.defaults?.renderer;
    if (!rendererType) {
      return c.json({ success: false, message: 'No renderer specified' }, 400);
    }
    const renderer = getRenderer(rendererType);

    const html = await renderer.render(template.templatePath, payload);

    client = createEmailClient(accountConfig);
    const result = await sendEmail(
      client,
      html,
      body,
      template,
      accountConfig,
      config.requestValidation,
    );

    const response: SendResponse = {
      success: true,
      messageId: result.messageId,
    };

    return c.json(response);
  } catch (error: unknown) {
    return handleChannelError(c, error, {
      providerLabel: 'Email',
      logMessage: 'Error processing email send request',
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
