import * as esbuild from 'esbuild';
import yaml from 'js-yaml';
import mjml2html from 'mjml';
import * as fs from 'node:fs';
import * as path from 'node:path';

type RendererType = 'react-email' | 'mjml' | 'html';

interface TemplateYaml {
  id?: string;
  renderer?: RendererType;
  [key: string]: unknown;
}

class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}

const DEFAULT_INPUT = '/templates-src';
const DEFAULT_OUTPUT = '/app/templates';

function printUsage(): void {
  console.error(
    'Usage: compile-templates <inputDir> <outputDir>\n' +
      `Defaults: ${DEFAULT_INPUT} ${DEFAULT_OUTPUT}`,
  );
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function findTemplateYamlFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('_')) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'template.yaml') {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

function loadTemplateYaml(filePath: string): TemplateYaml {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new CompileError(`Failed to parse ${filePath}`);
  }
  return parsed as TemplateYaml;
}

function writeTemplateYaml(filePath: string, config: TemplateYaml): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, yaml.dump(config, { lineWidth: 120 }), 'utf-8');
}

function resolveRenderer(
  config: TemplateYaml,
  templateDir: string,
): RendererType {
  if (config.renderer) {
    return config.renderer;
  }
  if (fs.existsSync(path.join(templateDir, 'index.tsx'))) {
    return 'react-email';
  }
  if (fs.existsSync(path.join(templateDir, 'index.mjml'))) {
    return 'mjml';
  }
  return 'html';
}

async function compileReactEmail(
  entryPath: string,
  outfile: string,
): Promise<void> {
  ensureDir(path.dirname(outfile));

  const nodePaths = [
    path.resolve(process.cwd(), 'node_modules'),
    path.resolve(process.cwd(), '../node_modules'),
    path.resolve(process.cwd(), '../../node_modules'),
  ].filter((p) => fs.existsSync(p));

  const result = await esbuild.build({
    entryPoints: [entryPath],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    jsx: 'automatic',
    jsxImportSource: 'react',
    nodePaths,
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
    throw new CompileError(messages.join('\n'));
  }
}

function compileMjml(entryPath: string, outfile: string): void {
  const mjmlContent = fs.readFileSync(entryPath, 'utf-8');
  const { html, errors } = mjml2html(mjmlContent, {
    validationLevel: 'soft',
  });

  if (errors.length > 0) {
    const details = errors
      .map((err) => err.formattedMessage ?? err.message)
      .join('\n');
    throw new CompileError(
      `MJML compilation failed for ${entryPath}:\n${details}`,
    );
  }

  ensureDir(path.dirname(outfile));
  fs.writeFileSync(outfile, html, 'utf-8');
}

async function compileTemplateYaml(
  yamlPath: string,
  inputRoot: string,
  outputRoot: string,
): Promise<string> {
  const templateDir = path.dirname(yamlPath);
  const relativeDir = path.relative(inputRoot, templateDir);
  const config = loadTemplateYaml(yamlPath);

  if (!config.id) {
    throw new CompileError(
      `Template at ${yamlPath} is missing required field: id`,
    );
  }

  const renderer = resolveRenderer(config, templateDir);
  const outDir = path.join(outputRoot, relativeDir);
  ensureDir(outDir);

  const outConfig: TemplateYaml = { ...config };

  if (renderer === 'react-email') {
    const entry = path.join(templateDir, 'index.tsx');
    if (!fs.existsSync(entry)) {
      throw new CompileError(`Template file not found: ${entry}`);
    }
    await compileReactEmail(entry, path.join(outDir, 'index.mjs'));
    outConfig.renderer = 'react-email';
  } else if (renderer === 'mjml') {
    const entry = path.join(templateDir, 'index.mjml');
    if (!fs.existsSync(entry)) {
      throw new CompileError(`Template file not found: ${entry}`);
    }
    compileMjml(entry, path.join(outDir, 'index.html'));
    outConfig.renderer = 'html';
  } else {
    const entry = path.join(templateDir, 'index.html');
    if (!fs.existsSync(entry)) {
      throw new CompileError(`Template file not found: ${entry}`);
    }
    copyFile(entry, path.join(outDir, 'index.html'));
    outConfig.renderer = 'html';
  }

  writeTemplateYaml(path.join(outDir, 'template.yaml'), outConfig);
  console.log(`Compiled ${config.id} (${renderer}) → ${relativeDir || '.'}`);
  return config.id;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    return;
  }

  const inputDir = path.resolve(args[0] ?? DEFAULT_INPUT);
  const outputDir = path.resolve(args[1] ?? DEFAULT_OUTPUT);

  if (!fs.existsSync(inputDir)) {
    throw new CompileError(`Input directory not found: ${inputDir}`);
  }

  ensureDir(outputDir);

  const yamlFiles = findTemplateYamlFiles(inputDir);
  if (yamlFiles.length === 0) {
    throw new CompileError(`No template.yaml files found in ${inputDir}`);
  }

  const seenIds = new Map<string, string>();
  for (const yamlPath of yamlFiles) {
    const config = loadTemplateYaml(yamlPath);
    if (!config.id) {
      throw new CompileError(
        `Template at ${yamlPath} is missing required field: id`,
      );
    }
    const existing = seenIds.get(config.id);
    if (existing) {
      throw new CompileError(
        `Duplicate template id "${config.id}" at ${yamlPath} (also at ${existing})`,
      );
    }
    seenIds.set(config.id, yamlPath);
  }

  const failures: { templateId: string; error: string }[] = [];
  let successCount = 0;

  for (const yamlPath of yamlFiles) {
    let templateId = path.basename(path.dirname(yamlPath));
    try {
      templateId = await compileTemplateYaml(yamlPath, inputDir, outputDir);
      successCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ templateId, error: message });
      console.error(`Failed ${templateId}: ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new CompileError(
      `${String(failures.length)} template(s) failed to compile:\n` +
        failures.map((f) => `  - ${f.templateId}: ${f.error}`).join('\n'),
    );
  }

  console.log(`\nCompiled ${String(successCount)} template(s) → ${outputDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  // eslint-disable-next-line n/no-process-exit -- CLI
  process.exit(1);
});
