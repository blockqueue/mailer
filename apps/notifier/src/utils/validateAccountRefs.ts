import type { GlobalConfig } from '../types/config';
import type { TemplateLoader } from './loaders/template.loader';

export function validateAccountReferences(
  config: GlobalConfig,
  templateLoader?: TemplateLoader,
): void {
  if (config.email?.defaults?.account) {
    const id = config.email.defaults.account;
    if (!(id in config.email.accounts)) {
      throw new Error(
        `email.defaults.account references unknown account: ${id}`,
      );
    }
  }

  if (config.sms?.defaults?.account) {
    const id = config.sms.defaults.account;
    if (!(id in config.sms.accounts)) {
      throw new Error(`sms.defaults.account references unknown account: ${id}`);
    }
  }

  if (templateLoader && config.email?.accounts) {
    const emailAccountIds = new Set(Object.keys(config.email.accounts));
    for (const templateId of templateLoader.getTemplateIds()) {
      const template = templateLoader.getTemplate(templateId);
      if (template?.account && !emailAccountIds.has(template.account)) {
        throw new Error(
          `Template "${templateId}" references unknown email account: ${template.account}`,
        );
      }
    }
  }
}
