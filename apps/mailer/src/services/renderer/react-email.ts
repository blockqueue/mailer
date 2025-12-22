import { render } from '@react-email/render';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

export class ReactEmailRenderer implements Renderer {
  async render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    // Resolve and validate the template path
    const absolutePath = resolveTemplatePath(templatePath);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(absolutePath);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const Component = module.default;
    if (!Component) {
      throw new Error(
        `Template ${templatePath} does not export a default component`,
      );
    }

    // Use @react-email/render to render the component with payload as props
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    const html = await render(Component(payload), {
      pretty: true,
    });

    return html;
  }
}
