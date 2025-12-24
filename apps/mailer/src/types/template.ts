/**
 * Template configuration structure matching template.yaml
 */
export interface TemplateConfig {
  id: string;
  renderer?: 'react-email' | 'mjml' | 'html';
  account?: string;
  from?: string; // Optional: default 'from' address for this template
  schema: unknown; // JSON Schema object
}
