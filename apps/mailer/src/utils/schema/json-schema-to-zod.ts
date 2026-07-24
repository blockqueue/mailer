import { z } from 'zod';

/** Convert a JSON Schema object to a Zod schema (common template patterns) */
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

    // JSON Schema fields are optional unless listed in `required`
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

    return z.object(shape);
  }

  if (jsonSchema.type === 'array') {
    const items = jsonSchema.items;
    if (items) {
      return z.array(jsonSchemaToZod(items));
    }
    return z.array(z.any());
  }

  if (jsonSchema.type === 'string') {
    if (jsonSchema.format === 'email') {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().email() is the correct Zod API
      return z.string().email();
    }
    return z.string();
  }

  if (jsonSchema.type === 'number' || jsonSchema.type === 'integer') {
    return z.number();
  }

  if (jsonSchema.type === 'boolean') {
    return z.boolean();
  }

  return z.unknown();
}
