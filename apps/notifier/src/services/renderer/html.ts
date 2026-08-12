import * as fs from 'fs';
import { logger } from '../../utils/logger';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}

function sanitizeSubstitutedValue(value: string): string {
  if (/^\s*(javascript|data|vbscript):/i.test(value)) {
    logger.warn({ value }, 'Blocked unsafe URL scheme in template substitution');
    return '';
  }
  return escapeHtml(value);
}

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
          return sanitizeSubstitutedValue(String(value));
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
