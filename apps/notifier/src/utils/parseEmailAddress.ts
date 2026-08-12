export function parseEmailAddress(value: string): {
  address: string;
  name?: string;
} {
  const trimmed = value.trim();
  const match = /^(.+?)\s*<([^>]+)>$/.exec(trimmed);
  if (match) {
    return { name: match[1].trim(), address: match[2].trim() };
  }
  return { address: trimmed };
}
