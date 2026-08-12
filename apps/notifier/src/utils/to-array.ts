export function toArray(
  value: string | string[] | undefined,
): string[] | undefined {
  return value ? (Array.isArray(value) ? value : [value]) : undefined;
}
