import { describe, expect, it } from 'vitest';
import { EmailRequestError } from '../errors/request-error';
import {
  clearHandlebarsCompileCache,
  renderHandlebarsTemplate,
} from './render-handlebars';

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

  it('renders empty for null referenced values and allows unused nulls', () => {
    expect(
      renderHandlebarsTemplate('Hi {{name}}', {
        name: null,
        unused: null,
      }),
    ).toBe('Hi ');
    expect(
      renderHandlebarsTemplate('{{#if flag}}yes{{else}}no{{/if}}', {
        flag: null,
      }),
    ).toBe('no');
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

  it('blocks obfuscated unsafe URL schemes', () => {
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: 'java\nscript:alert(1)',
      }),
    ).toBe('');
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: 'java\tscript:alert(1)',
      }),
    ).toBe('');
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: '\u0000javascript:alert(1)',
      }),
    ).toBe('');
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: 'javascript&colon;alert(1)',
      }),
    ).toBe('');
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: 'javascript&#58;alert(1)',
      }),
    ).toBe('');
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: 'javascript&#x3a;alert(1)',
      }),
    ).toBe('');
    expect(
      renderHandlebarsTemplate('{{url}}', {
        url: 'java\u200Bscript:alert(1)',
      }),
    ).toBe('');
  });

  it('rejects unescaped mustache forms (3+ braces or {{&)', () => {
    const cases = [
      '<a href="{{{url}}}">x</a>',
      '{{{{raw}}}}{{url}}{{{{/raw}}}}',
      '<a href="{{&url}}">x</a>',
    ];
    for (const content of cases) {
      expect(() =>
        renderHandlebarsTemplate(content, { url: 'https://ok.example' }),
      ).toThrow(EmailRequestError);
    }
    try {
      renderHandlebarsTemplate('<a href="{{{url}}}">x</a>', {
        url: 'https://ok.example',
      });
    } catch (error) {
      expect(error).toMatchObject({
        message: expect.stringContaining('Unescaped Handlebars'),
        status: 400,
      });
    }
  });

  it('sanitizes unsafe URL schemes inside arrays', () => {
    expect(
      renderHandlebarsTemplate('{{#each links}}{{this}}{{/each}}', {
        links: ['https://ok.example', 'javascript:alert(1)'],
      }),
    ).toBe('https://ok.example');
  });

  it('reuses compiled templates when cache key and mtime match', () => {
    clearHandlebarsCompileCache();
    const content = 'Hello {{name}}';
    const first = renderHandlebarsTemplate(
      content,
      { name: 'Ada' },
      { cacheKey: 't1', mtimeMs: 1 },
    );
    const second = renderHandlebarsTemplate(
      'Hello {{name}} IGNORE STALE SOURCE',
      { name: 'Bob' },
      { cacheKey: 't1', mtimeMs: 1 },
    );
    expect(first).toBe('Hello Ada');
    expect(second).toBe('Hello Bob');

    const third = renderHandlebarsTemplate(
      'Hi {{name}}',
      { name: 'Cara' },
      { cacheKey: 't1', mtimeMs: 2 },
    );
    expect(third).toBe('Hi Cara');
  });
});
