import * as fs from 'fs';
import { logger } from '../../utils/logger';
import { resolveTemplatePath } from '../../utils/template/template-path';
import type { Renderer } from './index';

interface MjmlError {
  line: number;
  message: string;
  tagName?: string;
  formattedMessage?: string;
}

interface MjmlResponse {
  html: string;
  errors: MjmlError[];
}

type Mjml2Html = (
  mjml: string,
  options?: { validationLevel?: 'strict' | 'soft' | 'skip' },
) => MjmlResponse;

function resolveMjml2Html(module: unknown): Mjml2Html {
  if (typeof module === 'function') {
    return module as Mjml2Html;
  }
  if (
    module &&
    typeof module === 'object' &&
    'default' in module &&
    typeof (module as { default: unknown }).default === 'function'
  ) {
    return (module as { default: Mjml2Html }).default;
  }
  throw new Error('Invalid mjml module shape');
}

export class MjmlRenderer implements Renderer {
  async render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const absolutePath = resolveTemplatePath(templatePath);

    let mjmlContent = fs.readFileSync(absolutePath, 'utf-8');

    mjmlContent = mjmlContent.replace(
      /\{\{(\w+)\}\}/g,
      (match, varName: string) => {
        const value = payload[varName];
        if (value === undefined || value === null) {
          logger.warn({ variable: varName }, 'Variable not found in payload');
          return match;
        }
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          return String(value);
        }
        logger.warn(
          { variable: varName, type: typeof value },
          'Variable has unsupported type, skipping substitution',
        );
        return match;
      },
    );

    let mjml2html: Mjml2Html;
    try {
      mjml2html = resolveMjml2Html(await import('mjml'));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Invalid mjml module shape'
      ) {
        throw error;
      }
      throw new Error(
        'MJML runtime is not installed. Precompile MJML templates with compile-templates, ' +
          'or install the mjml package for development rendering of index.mjml.',
      );
    }

    const { html, errors } = mjml2html(mjmlContent, {
      validationLevel: 'soft',
    });

    if (errors.length > 0) {
      logger.warn({ errors }, 'MJML compilation warnings');
    }

    return html;
  }
}
