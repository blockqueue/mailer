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

export function getRenderer(type: RendererType): Renderer {
  switch (type) {
    case 'react-email':
      return new ReactEmailRenderer();
    case 'mjml':
      return new MjmlRenderer();
    case 'html':
      return new HtmlRenderer();
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown renderer type: ${String(_exhaustive)}`);
    }
  }
}
