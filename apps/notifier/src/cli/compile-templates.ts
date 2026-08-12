import yaml from 'js-yaml';
import mjml2html from 'mjml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileReactEmailEntry } from '../services/renderer/compile-react-email';
import { getErrorMessage } from '../utils/errors/error-details';
import { findTemplateYamlFiles } from '../utils/loaders/template.loader';

type RendererType = 'react-email' | 'mjml' | 'html';

interface TemplateYaml {
  id?: string;
  renderer?: RendererType;
  [key: string]: unknown;
}

function isRendererType(value: unknown): value is RendererType {
  return value === 'react-email' || value === 'mjml' || value === 'html';
}

export class CompileError extends Error {
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

function loadTemplateYaml(filePath: string): TemplateYaml {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new CompileError(`Failed to parse ${filePath}`);
  }
  const config = parsed as Record<string, unknown>;
  const renderer = config.renderer;
  if (renderer !== undefined && !isRendererType(renderer)) {
    throw new CompileError(
      typeof renderer === 'string'
        ? `Unsupported renderer "${renderer}" in ${filePath}`
        : `Invalid renderer in ${filePath}`,
    );
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
    await compileReactEmailEntry(entry, path.join(outDir, 'index.mjs'));
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

export async function runCompileTemplates(args: string[]): Promise<void> {
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
      const message = getErrorMessage(error, String(error));
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

function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  const base = path.basename(entry);
  return (
    base === 'compile-templates.ts' ||
    base === 'compile-templates.mjs' ||
    base === 'compile-templates.js'
  );
}

if (isCliEntry()) {
  runCompileTemplates(process.argv.slice(2)).catch((error: unknown) => {
    console.error(getErrorMessage(error, String(error)));
    // eslint-disable-next-line n/no-process-exit -- CLI
    process.exit(1);
  });
}
