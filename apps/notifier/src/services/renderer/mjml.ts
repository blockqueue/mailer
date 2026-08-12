import { logger } from '../../utils/logger';
import { loadSubstitutedTemplate } from '../../utils/template/load-substituted-template';
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
  if (module && typeof module === 'object' && 'default' in module) {
    const defaultExport = module.default;
    if (typeof defaultExport === 'function') {
      return defaultExport as Mjml2Html;
    }
  }
  throw new Error('Invalid mjml module shape');
}

export class MjmlRenderer implements Renderer {
  async render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const mjmlContent = loadSubstitutedTemplate(templatePath, payload);

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
