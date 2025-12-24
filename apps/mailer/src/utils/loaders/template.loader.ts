import * as fs from 'fs';
import * as path from 'path';
import type { TemplateConfig } from '../../types/template';
import { logger } from '../logger';
import { loadYamlWithEnv } from './yaml.loader';

const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? '/templates';

export class TemplateLoader {
  private templates = new Map<
    string,
    TemplateConfig & { templatePath: string }
  >();
  private defaultRenderer?: 'react-email' | 'mjml' | 'html';

  constructor(defaultRenderer?: 'react-email' | 'mjml' | 'html') {
    this.defaultRenderer = defaultRenderer;
  }

  /**
   * Load and validate all templates at startup
   * @returns Object with success count, failure count, and whether to fail startup
   */
  loadAllTemplates(): {
    successCount: number;
    failureCount: number;
    failures: { templateId: string; error: string }[];
  } {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      logger.warn(
        { templatesDir: TEMPLATES_DIR },
        "Templates directory not found. Make sure it's mounted as a volume.",
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
        // Continue loading other templates
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

  /**
   * Load a single template configuration
   */
  private loadTemplate(
    templateId: string,
  ): TemplateConfig & { templatePath: string } {
    const templateDir = path.join(TEMPLATES_DIR, templateId);
    const templateYamlPath = path.join(templateDir, 'template.yaml');

    if (!fs.existsSync(templateYamlPath)) {
      throw new Error(`Template config not found: ${templateYamlPath}`);
    }

    const config = loadYamlWithEnv(templateYamlPath) as TemplateConfig;
    // Validate required fields
    if (!config.id) {
      throw new Error(`Template "${templateId}" is missing required field: id`);
    }

    if (config.id !== templateId) {
      throw new Error(
        `Template id "${config.id}" does not match directory name "${templateId}"`,
      );
    }

    // Use template renderer or fall back to default renderer
    const rendererType = config.renderer ?? this.defaultRenderer;

    // Renderer is validated by type, but check anyway
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

    // Determine template file path based on renderer
    // Use the resolved renderer type (template renderer or default)
    let templatePath: string;
    if (rendererType === 'react-email') {
      templatePath = path.join(templateDir, 'index.tsx');
    } else if (rendererType === 'mjml') {
      templatePath = path.join(templateDir, 'index.mjml');
    } else {
      // Default to HTML if no renderer is specified
      templatePath = path.join(templateDir, 'index.html');
    }

    // Verify template file exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    return {
      ...config,
      templatePath,
    };
  }

  /**
   * Get a template by ID
   */
  getTemplate(
    templateId: string,
  ): (TemplateConfig & { templatePath: string }) | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Check if a template exists
   */
  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }
}
