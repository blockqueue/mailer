export function getErrorMessage(
  error: unknown,
  fallback = 'Unknown error',
): string {
  return error instanceof Error ? error.message : fallback;
}

export function getErrorLogFields(error: unknown): {
  error: string;
  stack?: string;
} {
  const message = getErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return stack ? { error: message, stack } : { error: message };
}
