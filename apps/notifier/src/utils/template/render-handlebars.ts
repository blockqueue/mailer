import Handlebars from 'handlebars';
import { EmailRequestError } from '../errors/request-error';
import { logger } from '../logger';

type CompiledTemplate = Handlebars.TemplateDelegate;

const compiledCache = new Map<
  string,
  { mtimeMs: number; template: CompiledTemplate }
>();

function normalizeForSchemeCheck(value: string): string {
  let stripped = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200d) ||
      code === 0xfeff
    ) {
      continue;
    }
    stripped += char;
  }
  return stripped
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/&#x0*3a;|&#0*58;|&colon;/gi, ':');
}

function detectUnsafeUrlScheme(value: string): string | undefined {
  const normalized = normalizeForSchemeCheck(value);
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

function sanitizeStringLeaf(value: string, path: string): string {
  const scheme = detectUnsafeUrlScheme(value);
  if (scheme) {
    logger.warn(
      { variable: path, scheme },
      'Blocked unsafe URL scheme in template substitution',
    );
    return '';
  }
  return value;
}

function sanitizePayload(value: unknown, path: string): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeStringLeaf(value, path);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizePayload(item, `${path}[${String(index)}]`),
    );
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = sanitizePayload(child, childPath);
    }
    return result;
  }
  throw new EmailRequestError(
    `Template variable "${path || 'value'}" has unsupported type: ${typeof value}`,
    400,
  );
}

function mapHandlebarsError(error: unknown): never {
  if (error instanceof EmailRequestError) {
    throw error;
  }

  const message =
    error instanceof Error ? error.message : 'Handlebars render failed';

  const missingMatch = /"([^"]+)" not defined in/.exec(message);
  if (missingMatch?.[1]) {
    throw new EmailRequestError(
      `Template variable not found in payload: ${missingMatch[1]}`,
      400,
    );
  }

  throw new EmailRequestError(`Template render failed: ${message}`, 400);
}

function assertEscapedMustachesOnly(content: string): void {
  if (content.includes('{{{') || content.includes('{{&')) {
    throw new EmailRequestError(
      'Unescaped Handlebars output is not allowed in HTML/MJML templates (no {{{...}}}, {{{{...}}}}, or {{&...}}). Use {{...}} so values stay HTML-escaped.',
      400,
    );
  }
}

function getCompiledTemplate(
  content: string,
  cacheKey?: string,
  mtimeMs?: number,
): CompiledTemplate {
  if (cacheKey !== undefined && mtimeMs !== undefined) {
    const hit = compiledCache.get(cacheKey);
    if (hit?.mtimeMs === mtimeMs) {
      return hit.template;
    }
  }

  assertEscapedMustachesOnly(content);

  const template = Handlebars.compile(content, {
    strict: true,
    noEscape: false,
  });

  if (cacheKey !== undefined && mtimeMs !== undefined) {
    compiledCache.set(cacheKey, { mtimeMs, template });
  }

  return template;
}

export function clearHandlebarsCompileCache(): void {
  compiledCache.clear();
}

export function renderHandlebarsTemplate(
  content: string,
  payload: Record<string, unknown>,
  options?: { cacheKey?: string; mtimeMs?: number },
): string {
  const sanitized = sanitizePayload(payload, '') as Record<string, unknown>;

  try {
    const template = getCompiledTemplate(
      content,
      options?.cacheKey,
      options?.mtimeMs,
    );
    return template(sanitized);
  } catch (error) {
    mapHandlebarsError(error);
  }
}
