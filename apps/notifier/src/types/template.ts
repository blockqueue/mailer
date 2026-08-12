export interface TemplateConfig {
  id: string;
  renderer?: 'react-email' | 'mjml' | 'html';
  account?: string;
  from?: string;
  fromName?: string;
  subject?: string;
  replyTo?: string;
  schema: unknown;
}
