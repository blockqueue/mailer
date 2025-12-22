import { HtmlRenderer } from './html';
import { MjmlRenderer } from './mjml';
import { ReactEmailRenderer } from './react-email';

export type RendererType = 'react-email' | 'mjml' | 'html';

export interface Renderer {
  render(
    templatePath: string,
    payload: Record<string, unknown>,
  ): Promise<string>;
}

/**
 * Get a renderer instance by type
 */
export function getRenderer(type: RendererType): Renderer {
  switch (type) {
    case 'react-email':
      return new ReactEmailRenderer();
    case 'mjml':
      return new MjmlRenderer();
    case 'html':
      return new HtmlRenderer();
    default: {
      // This should never happen due to TypeScript, but handle it anyway
      const _exhaustive: never = type;
      throw new Error(`Unknown renderer type: ${String(_exhaustive)}`);
    }
  }
}
