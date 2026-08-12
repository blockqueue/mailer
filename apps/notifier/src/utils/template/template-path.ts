import * as fs from 'fs';
import * as path from 'path';

export function resolveTemplatePath(templatePath: string): string {
  const absolutePath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(templatePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }

  return absolutePath;
}
