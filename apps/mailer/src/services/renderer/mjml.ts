import fs from 'fs';
import mjml2html from 'mjml';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

export class MjmlRenderer implements Renderer {
  render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    // Resolve and validate the template path
    const absolutePath = resolveTemplatePath(templatePath);

    // Read the MJML file
    let mjmlContent = fs.readFileSync(absolutePath, 'utf-8');

    // Simple variable substitution: {{variableName}}
    // Replace placeholders with payload values
    mjmlContent = mjmlContent.replace(
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

    // Compile MJML to HTML
    const { html, errors } = mjml2html(mjmlContent, {
      validationLevel: 'soft',
    });

    if (errors.length > 0) {
      console.warn('MJML compilation warnings:', errors);
    }

    return Promise.resolve(html);
  }
}
