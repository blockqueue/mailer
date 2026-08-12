import { describe, expect, it } from 'vitest';
import { EmailRequestError } from '../errors/request-error';
import { renderHandlebarsTemplate } from './render-handlebars';

describe('renderHandlebarsTemplate', () => {
  it('substitutes string, number, and boolean values', () => {
    expect(
      renderHandlebarsTemplate('Hello {{name}} {{count}} {{ok}}', {
        name: 'Ada',
        count: 3,
        ok: true,
      }),
    ).toBe('Hello Ada 3 true');
  });

  it('HTML-escapes substituted values', () => {
    expect(
      renderHandlebarsTemplate('<p>{{value}}</p>', {
        value: `&<>"'`,
      }),
    ).toBe('<p>&amp;&lt;&gt;&quot;&#x27;</p>');
  });

  it('throws when a variable is missing', () => {
    expect(() => renderHandlebarsTemplate('Hi {{name}}', {})).toThrow(
      EmailRequestError,
    );
    try {
      renderHandlebarsTemplate('Hi {{name}}', {});
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Template variable not found in payload: name',
        status: 400,
      });
    }
  });

  it('throws when a variable is null', () => {
    expect(() =>
      renderHandlebarsTemplate('Hi {{name}}', { name: null }),
    ).toThrow(EmailRequestError);
  });

  it('supports nested paths', () => {
    expect(
      renderHandlebarsTemplate('Hello {{user.name}}', {
        user: { name: 'Ada' },
      }),
    ).toBe('Hello Ada');
  });

  it('supports each and if helpers', () => {
    expect(
      renderHandlebarsTemplate(
        '{{#each items}}<li>{{this}}</li>{{/each}}{{#if show}}yes{{/if}}',
        { items: ['a', 'b'], show: true },
      ),
    ).toBe('<li>a</li><li>b</li>yes');
  });

  it('replaces unsafe URL schemes with an empty string', () => {
    expect(
      renderHandlebarsTemplate('{{url}}', { url: 'javascript:alert(1)' }),
    ).toBe('');
    expect(renderHandlebarsTemplate('{{url}}', { url: 'data:text/html' })).toBe(
      '',
    );
    expect(renderHandlebarsTemplate('{{url}}', { url: 'vbscript:msg' })).toBe(
      '',
    );
    expect(
      renderHandlebarsTemplate('{{url}}', { url: '  JAVASCRIPT:alert(1)' }),
    ).toBe('');
  });

  it('sanitizes unsafe URL schemes inside arrays', () => {
    expect(
      renderHandlebarsTemplate('{{#each links}}{{this}}{{/each}}', {
        links: ['https://ok.example', 'javascript:alert(1)'],
      }),
    ).toBe('https://ok.example');
  });
});
