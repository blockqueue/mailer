import type { Context } from 'hono';

type ParsedBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

export function requireParsedBody(c: Context): ParsedBodyResult {
  const value: unknown = c.get('parsedBody');
  if (!value) {
    return {
      ok: false,
      response: c.json(
        { success: false, message: 'Request body not available' },
        500,
      ),
    };
  }
  return { ok: true, value };
}
