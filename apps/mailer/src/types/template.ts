/** Template configuration matching template.yaml */
export interface TemplateConfig {
  id: string;
  renderer?: 'react-email' | 'mjml' | 'html';
  account?: string;
  from?: string; // Optional default 'from' for this template
  schema: unknown; // JSON Schema object
}
