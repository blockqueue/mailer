import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

type EmailComponent = (props: Record<string, unknown>) => ReactElement;
interface EmailModule {
  default: { default: EmailComponent } | EmailComponent;
}

export class ReactEmailRenderer implements Renderer {
  async render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    // Resolve and validate the template path
    const absolutePath = resolveTemplatePath(templatePath);

    const module = (await import(absolutePath)) as EmailModule;

    // Handle nested default export structure from tsx/CJS interop
    const EmailComponent =
      typeof module.default === 'object' && 'default' in module.default
        ? module.default.default
        : module.default;

    if (typeof EmailComponent !== 'function') {
      throw new Error(`Template ${templatePath} has no default export`);
    }

    const emailElement = EmailComponent(payload);
    const html = await render(emailElement);

    return html;
  }
}
