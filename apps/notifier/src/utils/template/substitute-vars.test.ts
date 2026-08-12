import { describe, expect, it } from 'vitest';
import { EmailRequestError } from '../errors/request-error';
import { substituteTemplateVars } from './substitute-vars';

describe('substituteTemplateVars', () => {
  it('substitutes string, number, and boolean values', () => {
    expect(
      substituteTemplateVars('Hello {{name}} {{count}} {{ok}}', {
        name: 'Ada',
        count: 3,
        ok: true,
      }),
    ).toBe('Hello Ada 3 true');
  });

  it('HTML-escapes substituted values', () => {
    expect(
      substituteTemplateVars('<p>{{value}}</p>', {
        value: `&<>"'`,
      }),
    ).toBe('<p>&amp;&lt;&gt;&quot;&#39;</p>');
  });

  it('throws when a variable is missing', () => {
    expect(() => substituteTemplateVars('Hi {{name}}', {})).toThrow(
      EmailRequestError,
    );
    try {
      substituteTemplateVars('Hi {{name}}', {});
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Template variable not found in payload: name',
        status: 400,
      });
    }
  });

  it('throws when a variable is null', () => {
    expect(() => substituteTemplateVars('Hi {{name}}', { name: null })).toThrow(
      EmailRequestError,
    );
  });

  it('throws for object or array values', () => {
    expect(() =>
      substituteTemplateVars('{{user}}', { user: { name: 'Ada' } }),
    ).toThrow(/unsupported type: object/);
    expect(() => substituteTemplateVars('{{items}}', { items: ['a'] })).toThrow(
      /unsupported type: object/,
    );
  });

  it('does not substitute dotted or hyphenated names', () => {
    expect(substituteTemplateVars('{{user.name}} {{user-name}}', {})).toBe(
      '{{user.name}} {{user-name}}',
    );
  });

  it('replaces unsafe URL schemes with an empty string', () => {
    expect(
      substituteTemplateVars('{{url}}', { url: 'javascript:alert(1)' }),
    ).toBe('');
    expect(substituteTemplateVars('{{url}}', { url: 'data:text/html' })).toBe(
      '',
    );
    expect(substituteTemplateVars('{{url}}', { url: 'vbscript:msg' })).toBe('');
    expect(
      substituteTemplateVars('{{url}}', { url: '  JAVASCRIPT:alert(1)' }),
    ).toBe('');
  });
});
