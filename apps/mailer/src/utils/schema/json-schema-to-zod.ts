import { z } from 'zod';

/**
 * Convert a JSON Schema object to a Zod schema
 * Supports common JSON Schema patterns used in templates
 */
export function jsonSchemaToZod(schema: unknown): z.ZodType {
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Schema must be an object');
  }

  const jsonSchema = schema as Record<string, unknown>;

  // Handle type: object
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

    // Handle required fields
    // In JSON Schema, fields are optional by default unless listed in required array
    const required = jsonSchema.required as string[] | undefined;

    // Make fields optional if they're not in the required array
    if (required) {
      // If required array exists, only listed fields are required
      for (const key of Object.keys(shape)) {
        if (!required.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
    } else {
      // If no required array is specified, all fields are optional
      for (const key of Object.keys(shape)) {
        shape[key] = shape[key].optional();
      }
    }

    return z.object(shape);
  }

  // Handle type: array
  if (jsonSchema.type === 'array') {
    const items = jsonSchema.items;
    if (items) {
      return z.array(jsonSchemaToZod(items));
    }
    return z.array(z.any());
  }

  // Handle type: string
  if (jsonSchema.type === 'string') {
    // Handle format: email
    if (jsonSchema.format === 'email') {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().email() is the correct Zod API
      return z.string().email();
    }
    return z.string();
  }

  // Handle type: number
  if (jsonSchema.type === 'number' || jsonSchema.type === 'integer') {
    return z.number();
  }

  // Handle type: boolean
  if (jsonSchema.type === 'boolean') {
    return z.boolean();
  }

  // Fallback for unknown types
  return z.unknown();
}
