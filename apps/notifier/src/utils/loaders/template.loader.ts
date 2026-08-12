import * as fs from 'fs';
import * as path from 'path';
import type { TemplateConfig } from '../../types/template';
import { getErrorLogFields, getErrorMessage } from '../errors/error-details';
import { logger } from '../logger';
import { loadYamlWithEnv } from './yaml.loader';

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function findTemplateYamlFiles(rootDir: string): string[] {
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

export class TemplateLoader {
  private templates = new Map<
    string,
    TemplateConfig & { templatePath: string }
  >();
  private defaultRenderer?: 'react-email' | 'mjml' | 'html';
  private templatesDir: string;

  constructor(
    defaultRenderer?: 'react-email' | 'mjml' | 'html',
    templatesDir?: string,
  ) {
    this.defaultRenderer = defaultRenderer;
    this.templatesDir =
      templatesDir ?? process.env.TEMPLATES_DIR ?? '/app/templates';
  }

  loadAllTemplates(): {
    successCount: number;
    failureCount: number;
    failures: { templateId: string; error: string }[];
  } {
    if (!fs.existsSync(this.templatesDir)) {
      logger.warn(
        { templatesDir: this.templatesDir },
        'Templates directory not found. For production, bake compiled templates into the image (see examples/notifier-service). For local API dev, set TEMPLATES_DIR to your templates/ folder.',
      );
      return {
        successCount: 0,
        failureCount: 1,
        failures: [
          {
            templateId: '__no_templates__',
            error: 'Templates directory not found',
          },
        ],
      };
    }

    const yamlFiles = findTemplateYamlFiles(this.templatesDir);
    const failures: { templateId: string; error: string }[] = [];
    const seenIds = new Map<string, string>();

    for (const yamlPath of yamlFiles) {
      let templateId = path.basename(path.dirname(yamlPath));
      try {
        const templateConfig = this.loadTemplateFromYaml(yamlPath);
        templateId = templateConfig.id;

        const existingPath = seenIds.get(templateId);
        if (existingPath) {
          this.templates.delete(templateId);
          throw new Error(
            `Duplicate template id "${templateId}" (also at ${existingPath})`,
          );
        }
        seenIds.set(templateId, yamlPath);

        this.templates.set(templateId, templateConfig);
        logger.info({ templateId, yamlPath }, 'Loaded template');
      } catch (error) {
        const errorMessage = getErrorMessage(error, String(error));
        failures.push({ templateId, error: errorMessage });
        logger.error(
          {
            templateId,
            yamlPath,
            ...getErrorLogFields(error),
          },
          'Failed to load template',
        );
      }
    }

    const successCount = this.templates.size;
    const failureCount = failures.length;

    logger.info(
      { successCount, failureCount, total: yamlFiles.length },
      'Template loading completed',
    );

    if (failureCount > 0 && successCount === 0 && yamlFiles.length > 0) {
      logger.error(
        {
          failureCount,
          failures: failures.map((f) => `${f.templateId}: ${f.error}`),
        },
        'All templates failed to load.',
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

  private loadTemplateFromYaml(
    templateYamlPath: string,
  ): TemplateConfig & { templatePath: string } {
    const templateDir = path.dirname(templateYamlPath);
    const config = loadYamlWithEnv(templateYamlPath) as TemplateConfig;

    if (!config.id) {
      throw new Error(
        `Template at ${templateYamlPath} is missing required field: id`,
      );
    }

    const rendererType = config.renderer ?? this.defaultRenderer;

    if (!rendererType) {
      throw new Error(
        `Template "${config.id}" has no renderer and no default renderer is configured in email.defaults.renderer`,
      );
    }

    if (!['react-email', 'mjml', 'html'].includes(rendererType)) {
      throw new Error(
        `Template "${config.id}" has invalid renderer: ${rendererType}`,
      );
    }

    if (!config.schema) {
      throw new Error(
        `Template "${config.id}" is missing required field: schema`,
      );
    }

    const schema = config.schema as Record<string, unknown>;
    if (schema.type !== 'object') {
      throw new Error(`Template "${config.id}" schema must have type: object`);
    }

    const templatePath = this.resolveTemplateFile(templateDir, rendererType);

    return {
      ...config,
      templatePath,
    };
  }

  private resolveTemplateFile(
    templateDir: string,
    rendererType: 'react-email' | 'mjml' | 'html',
  ): string {
    if (rendererType === 'react-email') {
      const source = path.join(templateDir, 'index.tsx');
      const compiled = path.join(templateDir, 'index.mjs');

      if (isDev() && fs.existsSync(source)) {
        return source;
      }
      if (fs.existsSync(compiled)) {
        return compiled;
      }
      throw new Error(
        `React Email template not found in ${templateDir}. ` +
          'Production expects index.mjs (compile in your consumer Dockerfile; see examples/notifier-service). ' +
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

  getTemplateIds(): string[] {
    return [...this.templates.keys()];
  }

  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }
}
