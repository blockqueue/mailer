import { render } from '@react-email/render';
import { pathToFileURL } from 'node:url';
import type { ReactElement } from 'react';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

type EmailComponent = (props: Record<string, unknown>) => ReactElement;
interface EmailModule {
  default?: EmailComponent | { default: EmailComponent };
  Email?: EmailComponent;
}

function resolveEmailComponent(module: EmailModule): EmailComponent {
  const exported = module.default ?? module.Email;

  if (typeof exported === 'function') {
    return exported;
  }

  if (
    exported &&
    typeof exported === 'object' &&
    'default' in exported &&
    typeof exported.default === 'function'
  ) {
    return exported.default;
  }

  throw new Error('Template module has no default (or Email) export');
}

export class ReactEmailRenderer implements Renderer {
  async render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const absolutePath = resolveTemplatePath(templatePath);
    const moduleUrl = pathToFileURL(absolutePath).href;
    const module = (await import(moduleUrl)) as EmailModule;

    const EmailComponent = resolveEmailComponent(module);
    const emailElement = EmailComponent(payload);
    return await render(emailElement);
  }
}
