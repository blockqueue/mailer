export function parseEmailAddress(value: string): {
  address: string;
  name?: string;
} {
  const trimmed = value.trim();
  const open = trimmed.lastIndexOf('<');
  if (open > 0 && trimmed.endsWith('>')) {
    const name = trimmed.slice(0, open).trim();
    const address = trimmed.slice(open + 1, -1).trim();
    if (
      name.length > 0 &&
      address.length > 0 &&
      !address.includes('<') &&
      !address.includes('>')
    ) {
      return { name, address };
    }
  }
  return { address: trimmed };
}
