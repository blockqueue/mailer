import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function createTempDir(
  prefix = 'notifier-test-',
): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function writeTempFile(
  dir: string,
  relativePath: string,
  contents: string,
): Promise<string> {
  const fullPath = path.join(dir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, contents, 'utf-8');
  return fullPath;
}
