import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { templatesFixtureDir } from '../../../test/helpers/paths';
import {
  createTempDir,
  removeTempDir,
  writeTempFile,
} from '../../../test/helpers/temp-dir';
import { findTemplateYamlFiles, TemplateLoader } from './template.loader';

describe('findTemplateYamlFiles', () => {
  it('finds nested templates and skips underscore directories', () => {
    const files = findTemplateYamlFiles(templatesFixtureDir);
    const ids = files.map((file) => path.basename(path.dirname(file))).sort();
    expect(ids).toEqual(['html-welcome', 'mjml-otp', 'react-email-welcome']);
  });
});

describe('TemplateLoader', () => {
  let dir: string;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(async () => {
    process.env.NODE_ENV = previousNodeEnv;
    if (dir) {
      await removeTempDir(dir);
    }
  });

  it('loads templates by unique id, not folder name', () => {
    const loader = new TemplateLoader('html', templatesFixtureDir);
    const result = loader.loadAllTemplates();
    expect(result.failureCount).toBe(0);
    expect(loader.getTemplateIds().sort()).toEqual([
      'html-welcome',
      'mjml-otp',
      'react-email-welcome',
    ]);
    expect(loader.hasTemplate('html-welcome')).toBe(true);
    expect(loader.getTemplate('html-welcome')?.renderer).toBe('html');
  });

  it('fails duplicate ids and keeps neither copy', async () => {
    dir = await createTempDir();
    await writeTempFile(
      dir,
      'a/template.yaml',
      'id: dup\nrenderer: html\nschema:\n  type: object\n',
    );
    await writeTempFile(dir, 'a/index.html', '<p>a</p>');
    await writeTempFile(
      dir,
      'b/template.yaml',
      'id: dup\nrenderer: html\nschema:\n  type: object\n',
    );
    await writeTempFile(dir, 'b/index.html', '<p>b</p>');

    const loader = new TemplateLoader('html', dir);
    const result = loader.loadAllTemplates();
    expect(result.failureCount).toBe(1);
    expect(loader.hasTemplate('dup')).toBe(false);
  });

  it('reports missing id, schema, renderer, and files', async () => {
    dir = await createTempDir();
    await writeTempFile(dir, 'missing-id/template.yaml', 'renderer: html\n');
    await writeTempFile(
      dir,
      'missing-schema/template.yaml',
      'id: missing-schema\nrenderer: html\n',
    );
    await writeTempFile(
      dir,
      'missing-renderer/template.yaml',
      'id: missing-renderer\nschema:\n  type: object\n',
    );
    await writeTempFile(
      dir,
      'missing-file/template.yaml',
      'id: missing-file\nrenderer: html\nschema:\n  type: object\n',
    );

    const loader = new TemplateLoader(undefined, dir);
    const result = loader.loadAllTemplates();
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(4);
    const errors = result.failures.map((failure) => failure.error).join('\n');
    expect(errors).toMatch(/missing required field: id/);
    expect(errors).toMatch(/missing required field: schema/);
    expect(errors).toMatch(/no renderer/);
    expect(errors).toMatch(/Template file not found/);
  });

  it('uses index.tsx in development and index.mjs otherwise', async () => {
    dir = await createTempDir();
    await writeTempFile(
      dir,
      'react/template.yaml',
      'id: react\nrenderer: react-email\nschema:\n  type: object\n',
    );
    await writeTempFile(
      dir,
      'react/index.tsx',
      'export default function T() {}',
    );
    await writeTempFile(
      dir,
      'react/index.mjs',
      'export default function T() {}',
    );

    process.env.NODE_ENV = 'development';
    const devLoader = new TemplateLoader('react-email', dir);
    expect(devLoader.loadAllTemplates().successCount).toBe(1);
    expect(devLoader.getTemplate('react')?.templatePath).toMatch(/index\.tsx$/);

    process.env.NODE_ENV = 'production';
    const prodLoader = new TemplateLoader('react-email', dir);
    expect(prodLoader.loadAllTemplates().successCount).toBe(1);
    expect(prodLoader.getTemplate('react')?.templatePath).toMatch(
      /index\.mjs$/,
    );
  });

  it('returns a synthetic failure when the templates dir is missing', () => {
    const loader = new TemplateLoader(
      'html',
      '/tmp/notifier-missing-templates',
    );
    const result = loader.loadAllTemplates();
    expect(result.successCount).toBe(0);
    expect(result.failures[0]?.templateId).toBe('__no_templates__');
  });
});
