import * as fs from 'fs';
import { logger } from '../../utils/logger';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

export class HtmlRenderer implements Renderer {
  render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const absolutePath = resolveTemplatePath(templatePath);

    let htmlContent = fs.readFileSync(absolutePath, 'utf-8');

    htmlContent = htmlContent.replace(
      /\{\{(\w+)\}\}/g,
      (match, varName: string) => {
        const value = payload[varName];
        if (value === undefined || value === null) {
          logger.warn({ variable: varName }, 'Variable not found in payload');
          return match;
        }
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          return String(value);
        }
        logger.warn(
          { variable: varName, type: typeof value },
          'Variable has unsupported type, skipping substitution',
        );
        return match;
      },
    );

    return Promise.resolve(htmlContent);
  }
}
