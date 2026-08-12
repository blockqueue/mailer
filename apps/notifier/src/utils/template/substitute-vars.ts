import { EmailRequestError } from '../errors/request-error';
import { logger } from '../logger';

function escapeHtml(value: string): string {
  let result = '';
  for (const ch of value) {
    switch (ch) {
      case '&':
        result += '&amp;';
        break;
      case '<':
        result += '&lt;';
        break;
      case '>':
        result += '&gt;';
        break;
      case '"':
        result += '&quot;';
        break;
      case "'":
        result += '&#39;';
        break;
      default:
        result += ch;
    }
  }
  return result;
}

function hasUnsafeUrlScheme(value: string): boolean {
  const normalized = value.trimStart().toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:')
  );
}

function sanitizeSubstitutedValue(value: string): string {
  if (hasUnsafeUrlScheme(value)) {
    logger.warn(
      { value },
      'Blocked unsafe URL scheme in template substitution',
    );
    return '';
  }
  return escapeHtml(value);
}

export function substituteTemplateVars(
  content: string,
  payload: Record<string, unknown>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = payload[varName];
    if (value === undefined || value === null) {
      throw new EmailRequestError(
        `Template variable not found in payload: ${varName}`,
        400,
      );
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return sanitizeSubstitutedValue(String(value));
    }
    throw new EmailRequestError(
      `Template variable "${varName}" has unsupported type: ${typeof value}`,
      400,
    );
  });
}
