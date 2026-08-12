import * as fs from 'fs';
import { substituteTemplateVars } from './substitute-vars';
import { resolveTemplatePath } from './template-path';

export function loadSubstitutedTemplate(
  templatePath: string,
  payload: Record<string, unknown>,
): string {
  const absolutePath = resolveTemplatePath(templatePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return substituteTemplateVars(content, payload);
}
