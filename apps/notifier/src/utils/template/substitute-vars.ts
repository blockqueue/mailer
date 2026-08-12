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
  return content.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
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
  });
}
