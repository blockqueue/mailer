import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../../types/hono';
import { requireParsedBody } from './require-parsed-body';

describe('requireParsedBody', () => {
  it('returns 500 when parsedBody is missing', async () => {
    const app = new Hono<AppEnv>();
    app.post('/', (c) => {
      const parsed = requireParsedBody(c);
      if (!parsed.ok) {
        return parsed.response;
      }
      return c.json({ ok: true });
    });

    const response = await app.request('/', { method: 'POST' });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Request body not available',
    });
  });
});
