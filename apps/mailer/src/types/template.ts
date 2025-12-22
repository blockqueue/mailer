/**
 * Template configuration structure matching template.yaml
 */
export interface TemplateConfig {
  id: string;
  renderer?: 'react-email' | 'mjml' | 'html';
  defaultAccount?: string;
  schema: unknown; // JSON Schema object
}
