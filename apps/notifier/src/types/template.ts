export interface TemplateConfig {
  id: string;
  renderer?: 'react-email' | 'mjml' | 'html';
  account?: string;
  from?: string;
  schema: unknown;
}
