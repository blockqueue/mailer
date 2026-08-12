import { loadSubstitutedTemplate } from '../../utils/template/load-substituted-template';
import type { Renderer } from './index';

export class HtmlRenderer implements Renderer {
  render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    return Promise.resolve(loadSubstitutedTemplate(templatePath, payload));
  }
}
