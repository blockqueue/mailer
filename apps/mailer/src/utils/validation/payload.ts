import { z } from 'zod';
import { jsonSchemaToZod } from '../schema/json-schema-to-zod';

/**
 * Validate payload against a JSON Schema (converted to Zod)
 */
export function validatePayload(
  schema: unknown,
  payload: unknown,
): { valid: boolean; errors?: string[] } {
  try {
    const zodSchema = jsonSchemaToZod(schema);
    zodSchema.parse(payload);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `${path}: ${issue.message}`;
      });
      return { valid: false, errors };
    }
    // Fallback for unexpected errors
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Validation failed'],
    };
  }
}
