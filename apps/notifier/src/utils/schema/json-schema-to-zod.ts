import { z } from 'zod';

function applyNumberBounds(
  schema: z.ZodNumber,
  jsonSchema: Record<string, unknown>,
): z.ZodNumber {
  let next = schema;
  if (typeof jsonSchema.minimum === 'number') {
    next = next.min(jsonSchema.minimum);
  }
  if (typeof jsonSchema.maximum === 'number') {
    next = next.max(jsonSchema.maximum);
  }
  return next;
}

function applyStringConstraints(
  schema: z.ZodString,
  jsonSchema: Record<string, unknown>,
): z.ZodType {
  if (jsonSchema.format === 'uri') {
    return z.url();
  }

  let next = schema;
  if (typeof jsonSchema.minLength === 'number') {
    next = next.min(jsonSchema.minLength);
  }
  if (typeof jsonSchema.maxLength === 'number') {
    next = next.max(jsonSchema.maxLength);
  }
  if (typeof jsonSchema.pattern === 'string') {
    next = next.regex(new RegExp(jsonSchema.pattern));
  }
  if (jsonSchema.format === 'email') {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().email() is the correct Zod API
    next = next.email();
  }
  return next;
}

function applyEnum(
  schema: z.ZodType,
  jsonSchema: Record<string, unknown>,
): z.ZodType {
  if (!Array.isArray(jsonSchema.enum) || jsonSchema.enum.length === 0) {
    return schema;
  }
  const values = jsonSchema.enum as [string, ...string[]];
  return z.enum(values);
}

export function jsonSchemaToZod(schema: unknown): z.ZodType {
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Schema must be an object');
  }

  const jsonSchema = schema as Record<string, unknown>;

  if (Array.isArray(jsonSchema.type)) {
    const types = (jsonSchema.type as unknown[]).filter(
      (t): t is string => typeof t === 'string' && t !== 'null',
    );
    const allowsNull = (jsonSchema.type as unknown[]).includes('null');
    if (types.length === 1) {
      const base = jsonSchemaToZod({ ...jsonSchema, type: types[0] });
      return allowsNull ? base.nullable() : base;
    }
  }

  if (jsonSchema.type === 'object') {
    const shape: Record<string, z.ZodType> = {};
    const properties = jsonSchema.properties as
      | Record<string, unknown>
      | undefined;

    if (properties) {
      for (const [key, propSchema] of Object.entries(properties)) {
        shape[key] = jsonSchemaToZod(propSchema);
      }
    }

    const required = jsonSchema.required as string[] | undefined;

    if (required) {
      for (const key of Object.keys(shape)) {
        if (!required.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
    } else {
      for (const key of Object.keys(shape)) {
        shape[key] = shape[key].optional();
      }
    }

    let objectSchema = z.object(shape);
    if (jsonSchema.additionalProperties !== true) {
      objectSchema = objectSchema.strict();
    }

    return objectSchema;
  }

  if (jsonSchema.type === 'array') {
    const items = jsonSchema.items;
    if (items) {
      return z.array(jsonSchemaToZod(items));
    }
    return z.array(z.any());
  }

  if (jsonSchema.type === 'string') {
    if (Array.isArray(jsonSchema.enum) && jsonSchema.enum.length > 0) {
      return applyEnum(z.string(), jsonSchema);
    }
    return applyStringConstraints(z.string(), jsonSchema);
  }

  if (jsonSchema.type === 'number') {
    return applyNumberBounds(z.number(), jsonSchema);
  }

  if (jsonSchema.type === 'integer') {
    return applyNumberBounds(z.number().int(), jsonSchema);
  }

  if (jsonSchema.type === 'boolean') {
    return z.boolean();
  }

  if (jsonSchema.type === 'null') {
    return z.null();
  }

  if (Array.isArray(jsonSchema.enum) && jsonSchema.enum.length > 0) {
    return applyEnum(z.string(), jsonSchema);
  }

  return z.unknown();
}
