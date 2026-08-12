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

function detectUnsafeUrlScheme(value: string): string | undefined {
  const normalized = value.trimStart().toLowerCase();
  if (normalized.startsWith('javascript:')) {
    return 'javascript';
  }
  if (normalized.startsWith('data:')) {
    return 'data';
  }
  if (normalized.startsWith('vbscript:')) {
    return 'vbscript';
  }
  return undefined;
}

function sanitizeSubstitutedValue(value: string, varName: string): string {
  const scheme = detectUnsafeUrlScheme(value);
  if (scheme) {
    logger.warn(
      { variable: varName, scheme },
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
  return content.replace(/\{\{(\w+)\}\}/g, (matched) => {
    const varName = matched.slice(2, -2);
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
      return sanitizeSubstitutedValue(String(value), varName);
    }
    throw new EmailRequestError(
      `Template variable "${varName}" has unsupported type: ${typeof value}`,
      400,
    );
  });
}
