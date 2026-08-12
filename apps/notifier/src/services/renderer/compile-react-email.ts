import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const RUNTIME_CACHE_DIR = '.notifier-cache';

export function resolveReactEmailNodePaths(): string[] {
  return [
    path.resolve(process.cwd(), 'node_modules'),
    path.resolve(process.cwd(), '../node_modules'),
    path.resolve(process.cwd(), '../../node_modules'),
  ].filter((p) => fs.existsSync(p));
}

export async function compileReactEmailEntry(
  entryPath: string,
  outfile: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });

  const result = await esbuild.build({
    entryPoints: [entryPath],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    jsx: 'automatic',
    jsxImportSource: 'react',
    nodePaths: resolveReactEmailNodePaths(),
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@react-email/render',
    ],
    logLevel: 'silent',
    write: true,
  });

  if (result.errors.length > 0) {
    const messages = await esbuild.formatMessages(result.errors, {
      kind: 'error',
      color: false,
    });
    throw new Error(messages.join('\n'));
  }
}

function latestSourceMtimeInDir(dir: string): number {
  let latest = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestSourceMtimeInDir(fullPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      latest = Math.max(latest, fs.statSync(fullPath).mtimeMs);
    }
  }

  return latest;
}

const runtimeCompileCache = new Map<
  string,
  { sourceMtimeMs: number; modulePath: string }
>();

/** Compile a React Email entry beside the template (cached by source dir mtime). */
export async function compileReactEmailForRuntime(
  entryPath: string,
): Promise<string> {
  const absoluteEntry = path.resolve(entryPath);
  const templateDir = path.dirname(absoluteEntry);
  const sourceMtimeMs = latestSourceMtimeInDir(templateDir);
  const outDir = path.join(templateDir, RUNTIME_CACHE_DIR);
  const outfile = path.join(outDir, 'index.mjs');
  const cached = runtimeCompileCache.get(absoluteEntry);

  if (cached?.sourceMtimeMs === sourceMtimeMs) {
    return cached.modulePath;
  }

  await compileReactEmailEntry(absoluteEntry, outfile);
  runtimeCompileCache.set(absoluteEntry, {
    sourceMtimeMs,
    modulePath: outfile,
  });
  return outfile;
}
