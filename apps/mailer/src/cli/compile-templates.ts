/**
 * Compile templates for production: .tsx→index.mjs, .mjml→index.html (renderer→html), .html copy.
 * Usage: node dist/compile-templates.mjs [inputDir] [outputDir]  (defaults: /templates-src → /templates)
 */
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
const DEFAULT_OUTPUT = '/templates';

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

  // Help esbuild resolve hoisted deps in npm workspaces / Docker compile stages
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
    // Shared with the mailer runtime — do not duplicate React / render
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
    for (const err of errors) {
      console.warn(
        `[mjml] ${entryPath}: ${err.formattedMessage ?? err.message}`,
      );
    }
  }

  ensureDir(path.dirname(outfile));
  fs.writeFileSync(outfile, html, 'utf-8');
}

async function compileTemplateDir(
  templateId: string,
  inputDir: string,
  outputRoot: string,
): Promise<void> {
  const templateDir = path.join(inputDir, templateId);
  const yamlPath = path.join(templateDir, 'template.yaml');

  if (!fs.existsSync(yamlPath)) {
    throw new CompileError(`Missing template.yaml in ${templateDir}`);
  }

  const config = loadTemplateYaml(yamlPath);
  if (!config.id) {
    throw new CompileError(
      `Template "${templateId}" is missing required field: id`,
    );
  }
  if (config.id !== templateId) {
    throw new CompileError(
      `Template id "${config.id}" does not match directory name "${templateId}"`,
    );
  }

  const renderer = resolveRenderer(config, templateDir);
  const outDir = path.join(outputRoot, templateId);
  ensureDir(outDir);

  const outConfig: TemplateYaml = { ...config };

  if (renderer === 'react-email') {
    const entry = path.join(templateDir, 'index.tsx');
    if (!fs.existsSync(entry)) {
      throw new CompileError(`Template file not found: ${entry}`);
    }
    await compileReactEmail(entry, path.join(outDir, 'index.mjs'));
  } else if (renderer === 'mjml') {
    const entry = path.join(templateDir, 'index.mjml');
    if (!fs.existsSync(entry)) {
      throw new CompileError(`Template file not found: ${entry}`);
    }
    compileMjml(entry, path.join(outDir, 'index.html'));
    // Runtime uses the HTML renderer after MJML has been precompiled
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
  console.log(`Compiled ${templateId} (${renderer})`);
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

  const templateDirs = fs
    .readdirSync(inputDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();

  if (templateDirs.length === 0) {
    throw new CompileError(`No template directories found in ${inputDir}`);
  }

  const failures: { templateId: string; error: string }[] = [];

  for (const templateId of templateDirs) {
    try {
      await compileTemplateDir(templateId, inputDir, outputDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ templateId, error: message });
      console.error(`Failed ${templateId}: ${message}`);
    }
  }

  if (failures.length > 0) {
    const failureCount = String(failures.length);
    throw new CompileError(
      `${failureCount} template(s) failed to compile:\n` +
        failures.map((f) => `  - ${f.templateId}: ${f.error}`).join('\n'),
    );
  }

  const successCount = String(templateDirs.length);
  console.log(`\nCompiled ${successCount} template(s) → ${outputDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  // CLI entrypoints need a non-zero exit; eslint n/no-process-exit is for libraries
  // eslint-disable-next-line n/no-process-exit -- CLI
  process.exit(1);
});
