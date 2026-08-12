import { afterEach, describe, expect, it } from 'vitest';
import { makeConfig } from '../../test/helpers/config';
import {
  createTempDir,
  removeTempDir,
  writeTempFile,
} from '../../test/helpers/temp-dir';
import { TemplateLoader } from './loaders/template.loader';
import { validateAccountReferences } from './validateAccountRefs';

describe('validateAccountReferences', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await removeTempDir(dir);
    }
  });

  it('accepts known default accounts', () => {
    expect(() => validateAccountReferences(makeConfig())).not.toThrow();
  });

  it('rejects an unknown email default account', () => {
    const config = makeConfig({
      email: {
        accounts: {
          zeptomail: {
            type: 'zeptomail',
            apiKey: 'key',
          },
        },
        defaults: { account: 'missing' },
      },
    });
    expect(() => validateAccountReferences(config)).toThrow(
      /unknown account: missing/,
    );
  });

  it('rejects an unknown SMS default account', () => {
    const config = makeConfig({
      sms: {
        accounts: {
          termii: { type: 'termii', apiKey: 'key' },
        },
        defaults: { account: 'missing' },
      },
    });
    expect(() => validateAccountReferences(config)).toThrow(
      /unknown account: missing/,
    );
  });

  it('rejects a template that references an unknown email account', async () => {
    dir = await createTempDir();
    await writeTempFile(
      dir,
      'welcome/template.yaml',
      'id: welcome\nrenderer: html\naccount: unknown\nschema:\n  type: object\n',
    );
    await writeTempFile(dir, 'welcome/index.html', '<p>Hi</p>');

    const loader = new TemplateLoader('html', dir);
    expect(loader.loadAllTemplates().successCount).toBe(1);

    expect(() => validateAccountReferences(makeConfig(), loader)).toThrow(
      /Template "welcome" references unknown email account: unknown/,
    );
  });
});
