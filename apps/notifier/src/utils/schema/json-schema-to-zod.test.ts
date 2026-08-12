import { describe, expect, it } from 'vitest';
import { validatePayload } from '../validation/payload';
import { jsonSchemaToZod } from './json-schema-to-zod';

describe('jsonSchemaToZod / validatePayload', () => {
  it('requires listed fields and treats others as optional', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        nickname: { type: 'string' },
      },
    };
    expect(validatePayload(schema, { name: 'Ada' }).valid).toBe(true);
    expect(validatePayload(schema, {}).valid).toBe(false);
    expect(validatePayload(schema, { name: 'Ada', nickname: 'A' }).valid).toBe(
      true,
    );
  });

  it('rejects unknown properties unless additionalProperties is true', () => {
    const strict = {
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    expect(validatePayload(strict, { name: 'Ada', extra: 1 }).valid).toBe(
      false,
    );

    const open = {
      type: 'object',
      additionalProperties: true,
      properties: { name: { type: 'string' } },
    };
    expect(validatePayload(open, { name: 'Ada', extra: 1 }).valid).toBe(true);
  });

  it('validates string constraints', () => {
    const schema = {
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          type: 'string',
          minLength: 2,
          maxLength: 5,
          pattern: '^[a-z]+$',
        },
      },
    };
    expect(validatePayload(schema, { value: 'ab' }).valid).toBe(true);
    expect(validatePayload(schema, { value: 'a' }).valid).toBe(false);
    expect(validatePayload(schema, { value: 'abcdef' }).valid).toBe(false);
    expect(validatePayload(schema, { value: 'A1' }).valid).toBe(false);
  });

  it('validates email and uri formats', () => {
    const schema = {
      type: 'object',
      required: ['email', 'url'],
      properties: {
        email: { type: 'string', format: 'email' },
        url: { type: 'string', format: 'uri' },
      },
    };
    expect(
      validatePayload(schema, {
        email: 'user@example.com',
        url: 'https://example.com',
      }).valid,
    ).toBe(true);
    expect(
      validatePayload(schema, {
        email: 'not-an-email',
        url: 'https://example.com',
      }).valid,
    ).toBe(false);
  });

  it('validates number and integer bounds', () => {
    const numberSchema = {
      type: 'object',
      required: ['n'],
      properties: { n: { type: 'number', minimum: 1, maximum: 10 } },
    };
    expect(validatePayload(numberSchema, { n: 5 }).valid).toBe(true);
    expect(validatePayload(numberSchema, { n: 0 }).valid).toBe(false);

    const integerSchema = {
      type: 'object',
      required: ['n'],
      properties: { n: { type: 'integer', minimum: 1 } },
    };
    expect(validatePayload(integerSchema, { n: 2 }).valid).toBe(true);
    expect(validatePayload(integerSchema, { n: 1.5 }).valid).toBe(false);
  });

  it('validates enums, arrays, booleans, and null', () => {
    const schema = {
      type: 'object',
      required: ['color', 'tags', 'ok', 'empty'],
      properties: {
        color: { type: 'string', enum: ['red', 'blue'] },
        tags: { type: 'array', items: { type: 'string' } },
        ok: { type: 'boolean' },
        empty: { type: 'null' },
      },
    };
    expect(
      validatePayload(schema, {
        color: 'red',
        tags: ['a'],
        ok: true,
        empty: null,
      }).valid,
    ).toBe(true);
    expect(
      validatePayload(schema, {
        color: 'green',
        tags: ['a'],
        ok: true,
        empty: null,
      }).valid,
    ).toBe(false);
  });

  it('supports nullable string unions', () => {
    const schema = {
      type: 'object',
      required: ['value'],
      properties: { value: { type: ['string', 'null'] } },
    };
    expect(validatePayload(schema, { value: 'ok' }).valid).toBe(true);
    expect(validatePayload(schema, { value: null }).valid).toBe(true);
    expect(validatePayload(schema, { value: 1 }).valid).toBe(false);
  });

  it('falls through multi-type unions to z.unknown()', () => {
    const schema = {
      type: 'object',
      required: ['value'],
      properties: { value: { type: ['string', 'number'] } },
    };
    expect(validatePayload(schema, { value: 'ok' }).valid).toBe(true);
    expect(validatePayload(schema, { value: 1 }).valid).toBe(true);
    expect(validatePayload(schema, { value: true }).valid).toBe(true);
  });

  it('returns details for invalid payloads', () => {
    const result = validatePayload(
      {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
      {},
    );
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toMatch(/name/);
  });

  it('throws when the schema is not an object', () => {
    expect(() => jsonSchemaToZod('nope')).toThrow('Schema must be an object');
    expect(validatePayload('nope', {}).valid).toBe(false);
  });
});
