import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

type EmailComponent = (props: Record<string, unknown>) => ReactElement;
interface EmailModule {
  default: EmailComponent;
}

export class ReactEmailRenderer implements Renderer {
  async render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    // Resolve and validate the template path
    const absolutePath = resolveTemplatePath(templatePath);

    const module = (await import(absolutePath)) as EmailModule;
    if (typeof module.default !== 'function') {
      throw new Error(
        `'Email' component not exported from template ${templatePath}`,
      );
    }

    const emailElement = module.default(payload);
    const html = await render(emailElement);

    return html;
  }
}
