import { z } from 'zod';

export function jsonSchemaToZod(schema: unknown): z.ZodType {
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Schema must be an object');
  }

  const jsonSchema = schema as Record<string, unknown>;

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
    if (jsonSchema.additionalProperties === false) {
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
    let stringSchema = z.string();

    if (typeof jsonSchema.minLength === 'number') {
      stringSchema = stringSchema.min(jsonSchema.minLength);
    }
    if (typeof jsonSchema.maxLength === 'number') {
      stringSchema = stringSchema.max(jsonSchema.maxLength);
    }
    if (typeof jsonSchema.pattern === 'string') {
      stringSchema = stringSchema.regex(new RegExp(jsonSchema.pattern));
    }
    if (jsonSchema.format === 'email') {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().email() is the correct Zod API
      stringSchema = stringSchema.email();
    }

    return stringSchema;
  }

  if (jsonSchema.type === 'number') {
    return z.number();
  }

  if (jsonSchema.type === 'integer') {
    return z.number().int();
  }

  if (jsonSchema.type === 'boolean') {
    return z.boolean();
  }

  return z.unknown();
}
