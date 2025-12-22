import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve and validate a template file path
 * Ensures the path is absolute and the file exists
 */
export function resolveTemplatePath(templatePath: string): string {
  // Ensure we have an absolute path
  const absolutePath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(templatePath);

  // Verify the file exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }

  return absolutePath;
}
