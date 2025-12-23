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

  /**
   * Load and validate all templates at startup
   */
  loadAllTemplates(): void {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      logger.warn(
        { templatesDir: TEMPLATES_DIR },
        "Templates directory not found. Make sure it's mounted as a volume.",
      );
      return;
    }

    const templateDirs = fs
      .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
      .map((dirent) => dirent.name);

    for (const templateId of templateDirs) {
      try {
        const templateConfig = this.loadTemplate(templateId);
        this.templates.set(templateId, templateConfig);
        logger.info({ templateId }, 'Loaded template');
      } catch (error) {
        logger.error({ templateId, error }, 'Failed to load template');
        // Continue loading other templates
      }
    }

    logger.info({ count: this.templates.size }, 'Template loading completed');
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

    const rendererType = config.renderer;
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
    let templatePath: string;
    if (config.renderer === 'react-email') {
      templatePath = path.join(templateDir, 'index.tsx');
    } else if (config.renderer === 'mjml') {
      templatePath = path.join(templateDir, 'index.mjml');
    } else {
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
