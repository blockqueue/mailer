import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { templatesFixtureDir } from '../../test/helpers/paths';
import {
  createTempDir,
  removeTempDir,
  writeTempFile,
} from '../../test/helpers/temp-dir';
import { CompileError, runCompileTemplates } from './compile-templates';

describe('runCompileTemplates', () => {
  let outputDir: string;

  afterEach(async () => {
    if (outputDir) {
      await removeTempDir(outputDir);
    }
  });

  it('compiles HTML, MJML, and React Email templates', async () => {
    outputDir = await createTempDir('compiled-templates-');
    await runCompileTemplates([templatesFixtureDir, outputDir]);

    const htmlYaml = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        path.join(outputDir, 'html-welcome', 'template.yaml'),
        'utf-8',
      ),
    );
    expect(htmlYaml).toMatch(/renderer: html/);

    const mjmlSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(path.join(outputDir, 'mjml-otp', 'index.mjml'), 'utf-8'),
    );
    expect(mjmlSource).toContain('<mjml>');
    expect(mjmlSource).toContain('{{code}}');
    const mjmlYaml = await import('node:fs/promises').then((fs) =>
      fs.readFile(path.join(outputDir, 'mjml-otp', 'template.yaml'), 'utf-8'),
    );
    expect(mjmlYaml).toMatch(/renderer: mjml/);

    const reactModule = await import('node:fs/promises').then((fs) =>
      fs.stat(path.join(outputDir, 'react-email-welcome', 'index.mjs')),
    );
    expect(reactModule.isFile()).toBe(true);
  });

  it('fails on duplicate ids', async () => {
    const inputDir = await createTempDir('dup-templates-');
    outputDir = await createTempDir('dup-out-');
    try {
      await writeTempFile(
        inputDir,
        'a/template.yaml',
        'id: dup\nrenderer: html\nschema:\n  type: object\n',
      );
      await writeTempFile(inputDir, 'a/index.html', '<p>a</p>');
      await writeTempFile(
        inputDir,
        'b/template.yaml',
        'id: dup\nrenderer: html\nschema:\n  type: object\n',
      );
      await writeTempFile(inputDir, 'b/index.html', '<p>b</p>');

      await expect(
        runCompileTemplates([inputDir, outputDir]),
      ).rejects.toBeInstanceOf(CompileError);
    } finally {
      await removeTempDir(inputDir);
    }
  });

  it('fails when the input directory is missing', async () => {
    await expect(
      runCompileTemplates(['/tmp/notifier-missing-input', '/tmp/out']),
    ).rejects.toThrow(/Input directory not found/);
  });

  it('fails when no template.yaml files exist', async () => {
    const inputDir = await createTempDir('empty-templates-');
    outputDir = await createTempDir('empty-out-');
    try {
      await expect(runCompileTemplates([inputDir, outputDir])).rejects.toThrow(
        /No template.yaml files found/,
      );
    } finally {
      await removeTempDir(inputDir);
    }
  });

  it('copies MJML source without baking to HTML', async () => {
    const inputDir = await createTempDir('copy-mjml-');
    outputDir = await createTempDir('copy-mjml-out-');
    try {
      await writeTempFile(
        inputDir,
        'otp/template.yaml',
        'id: copy-mjml\nrenderer: mjml\nschema:\n  type: object\n',
      );
      await writeTempFile(
        inputDir,
        'otp/index.mjml',
        '<mjml><mj-body><mj-text>{{code}}</mj-text></mj-body></mjml>',
      );
      await runCompileTemplates([inputDir, outputDir]);
      const copied = await import('node:fs/promises').then((fs) =>
        fs.readFile(path.join(outputDir, 'otp', 'index.mjml'), 'utf-8'),
      );
      expect(copied).toContain('{{code}}');
      const yaml = await import('node:fs/promises').then((fs) =>
        fs.readFile(path.join(outputDir, 'otp', 'template.yaml'), 'utf-8'),
      );
      expect(yaml).toMatch(/renderer: mjml/);
    } finally {
      await removeTempDir(inputDir);
    }
  });

  it('fails when a template id is missing', async () => {
    const inputDir = await createTempDir('missing-id-');
    outputDir = await createTempDir('missing-id-out-');
    try {
      await writeTempFile(
        inputDir,
        'html/template.yaml',
        'renderer: html\nschema:\n  type: object\n',
      );
      await writeTempFile(inputDir, 'html/index.html', '<p>hi</p>');
      await expect(runCompileTemplates([inputDir, outputDir])).rejects.toThrow(
        /missing required field: id/,
      );
    } finally {
      await removeTempDir(inputDir);
    }
  });

  it('fails when a source file is missing', async () => {
    const inputDir = await createTempDir('missing-src-');
    outputDir = await createTempDir('missing-src-out-');
    try {
      await writeTempFile(
        inputDir,
        'html/template.yaml',
        'id: missing-html\nrenderer: html\nschema:\n  type: object\n',
      );
      await expect(runCompileTemplates([inputDir, outputDir])).rejects.toThrow(
        /failed to compile/,
      );
    } finally {
      await removeTempDir(inputDir);
    }
  });
});
