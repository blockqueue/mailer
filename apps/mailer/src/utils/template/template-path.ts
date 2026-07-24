import * as fs from 'fs';
import * as path from 'path';

/** Resolve to an absolute path and ensure the file exists */
export function resolveTemplatePath(templatePath: string): string {
  const absolutePath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(templatePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }

  return absolutePath;
}
