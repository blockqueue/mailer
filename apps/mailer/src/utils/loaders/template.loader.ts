import * as fs from 'fs';
import * as path from 'path';
import type { TemplateConfig } from '../../types/template';
import { logger } from '../logger';
import { loadYamlWithEnv } from './yaml.loader';

/** Baked images use /app/templates so ESM imports resolve via /app/node_modules */
const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? '/app/templates';
const IS_DEV = process.env.NODE_ENV === 'development';

export class TemplateLoader {
  private templates = new Map<
    string,
    TemplateConfig & { templatePath: string }
  >();
  private defaultRenderer?: 'react-email' | 'mjml' | 'html';

  constructor(defaultRenderer?: 'react-email' | 'mjml' | 'html') {
    this.defaultRenderer = defaultRenderer;
  }

  loadAllTemplates(): {
    successCount: number;
    failureCount: number;
    failures: { templateId: string; error: string }[];
  } {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      logger.warn(
        { templatesDir: TEMPLATES_DIR },
        'Templates directory not found. For production, bake compiled templates into the image (see examples/mail-service). For local API dev, set TEMPLATES_DIR to your emails/ folder.',
      );
      return { successCount: 0, failureCount: 0, failures: [] };
    }

    const templateDirs = fs
      .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
      .map((dirent) => dirent.name);

    const failures: { templateId: string; error: string }[] = [];

    for (const templateId of templateDirs) {
      try {
        const templateConfig = this.loadTemplate(templateId);
        this.templates.set(templateId, templateConfig);
        logger.info({ templateId }, 'Loaded template');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        failures.push({ templateId, error: errorMessage });
        logger.error(
          {
            templateId,
            error: errorMessage,
            ...(errorStack && { stack: errorStack }),
          },
          'Failed to load template',
        );
      }
    }

    const successCount = this.templates.size;
    const failureCount = failures.length;

    logger.info(
      { successCount, failureCount, total: templateDirs.length },
      'Template loading completed',
    );

    if (failureCount > 0 && successCount === 0) {
      logger.error(
        {
          failureCount,
          failures: failures.map((f) => `${f.templateId}: ${f.error}`),
        },
        'All templates failed to load. Server will start but email sending may fail.',
      );
    } else if (failureCount > 0) {
      logger.warn(
        {
          failureCount,
          successCount,
          failures: failures.map((f) => `${f.templateId}: ${f.error}`),
        },
        'Some templates failed to load',
      );
    }

    return { successCount, failureCount, failures };
  }

  private loadTemplate(
    templateId: string,
  ): TemplateConfig & { templatePath: string } {
    const templateDir = path.join(TEMPLATES_DIR, templateId);
    const templateYamlPath = path.join(templateDir, 'template.yaml');

    if (!fs.existsSync(templateYamlPath)) {
      throw new Error(`Template config not found: ${templateYamlPath}`);
    }

    const config = loadYamlWithEnv(templateYamlPath) as TemplateConfig;
    if (!config.id) {
      throw new Error(`Template "${templateId}" is missing required field: id`);
    }

    if (config.id !== templateId) {
      throw new Error(
        `Template id "${config.id}" does not match directory name "${templateId}"`,
      );
    }

    const rendererType = config.renderer ?? this.defaultRenderer;

    if (
      rendererType &&
      !['react-email', 'mjml', 'html'].includes(rendererType)
    ) {
      throw new Error(
        `Template "${templateId}" has invalid renderer: ${rendererType}`,
      );
    }

    if (!config.schema) {
      throw new Error(
        `Template "${templateId}" is missing required field: schema`,
      );
    }

    const templatePath = this.resolveTemplateFile(templateDir, rendererType);

    return {
      ...config,
      templatePath,
    };
  }

  /**
   * Production (Distroless): compiled index.mjs / index.html only — no TS loader in the image.
   * Local `npm run dev` (NODE_ENV=development + tsx): prefer source index.tsx / index.mjml.
   */
  private resolveTemplateFile(
    templateDir: string,
    rendererType: 'react-email' | 'mjml' | 'html' | undefined,
  ): string {
    if (rendererType === 'react-email') {
      const source = path.join(templateDir, 'index.tsx');
      const compiled = path.join(templateDir, 'index.mjs');

      if (IS_DEV && fs.existsSync(source)) {
        return source;
      }
      if (fs.existsSync(compiled)) {
        return compiled;
      }
      throw new Error(
        `React Email template not found in ${templateDir}. ` +
          'Production expects index.mjs (compile in your consumer Dockerfile; see examples/mail-service). ' +
          'Local API development uses index.tsx via `npm run dev` (tsx) when NODE_ENV=development.',
      );
    }

    if (rendererType === 'mjml') {
      const source = path.join(templateDir, 'index.mjml');
      if (fs.existsSync(source)) {
        return source;
      }
      throw new Error(
        `Template file not found: ${source}. ` +
          'For production, compile MJML to HTML with compile-templates (renderer becomes html).',
      );
    }

    const htmlPath = path.join(templateDir, 'index.html');
    if (fs.existsSync(htmlPath)) {
      return htmlPath;
    }
    throw new Error(`Template file not found: ${htmlPath}`);
  }

  getTemplate(
    templateId: string,
  ): (TemplateConfig & { templatePath: string }) | undefined {
    return this.templates.get(templateId);
  }

  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }
}
