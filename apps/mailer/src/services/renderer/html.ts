import * as fs from 'fs';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

export class HtmlRenderer implements Renderer {
  render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    // Resolve and validate the template path
    const absolutePath = resolveTemplatePath(templatePath);

    // Read the HTML file
    let htmlContent = fs.readFileSync(absolutePath, 'utf-8');

    // Simple variable substitution: {{variableName}}
    // Replace placeholders with payload values
    htmlContent = htmlContent.replace(
      /\{\{(\w+)\}\}/g,
      (match, varName: string) => {
        const value = payload[varName];
        if (value === undefined || value === null) {
          console.warn(`Variable ${varName} not found in payload`);
          return match;
        }
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          return String(value);
        }
        console.warn(
          `Variable ${varName} has unsupported type, skipping substitution`,
        );
        return match;
      },
    );

    return Promise.resolve(htmlContent);
  }
}
