import * as fs from 'fs';
import { renderHandlebarsTemplate } from './render-handlebars';
import { resolveTemplatePath } from './template-path';

export function loadSubstitutedTemplate(
  templatePath: string,
  payload: Record<string, unknown>,
): string {
  const absolutePath = resolveTemplatePath(templatePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return renderHandlebarsTemplate(content, payload);
}
