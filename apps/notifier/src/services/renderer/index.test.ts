import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixturesDir, templatesFixtureDir } from '../../../test/helpers/paths';
import { HtmlRenderer } from './html';
import { MjmlRenderer } from './mjml';
import { ReactEmailRenderer } from './react-email';

describe('renderers', () => {
  it('renders HTML with substitution from disk', async () => {
    const html = await new HtmlRenderer().render(
      path.join(templatesFixtureDir, 'html-welcome', 'index.html'),
      { userName: 'Ada' },
    );
    expect(html).toContain('Hello Ada');
  });

  it('renders MJML to HTML', async () => {
    const html = await new MjmlRenderer().render(
      path.join(templatesFixtureDir, 'mjml-otp', 'index.mjml'),
      { code: '1234' },
    );
    expect(html).toContain('Your code is 1234');
    expect(html).toContain('<html');
  });

  it('renders an HTML order receipt with line items', async () => {
    const html = await new HtmlRenderer().render(
      path.join(templatesFixtureDir, 'html-order-receipt', 'index.html'),
      {
        orderId: 'ORD-1001',
        customerName: 'Ada',
        lineItems: [
          { name: 'USB-C Hub', quantity: 1, price: '$49.00' },
          { name: 'Cable', quantity: 2, price: '$12.00' },
        ],
        total: '$73.00',
      },
    );
    expect(html).toContain('Order ORD-1001 for Ada');
    expect(html).toContain('1× USB-C Hub — $49.00');
    expect(html).toContain('2× Cable — $12.00');
    expect(html).toContain('Total: $73.00');
  });

  it('renders an MJML order receipt with line items', async () => {
    const html = await new MjmlRenderer().render(
      path.join(templatesFixtureDir, 'mjml-order-receipt', 'index.mjml'),
      {
        orderId: 'ORD-1001',
        customerName: 'Ada',
        lineItems: [
          { name: 'USB-C Hub', quantity: 1, price: '$49.00' },
          { name: 'Cable', quantity: 2, price: '$12.00' },
        ],
        total: '$73.00',
      },
    );
    expect(html).toContain('Order ORD-1001');
    expect(html).toContain('USB-C Hub');
    expect(html).toContain('Cable');
    expect(html).toContain('Total: $73.00');
  });

  it('still returns HTML when MJML reports soft errors', async () => {
    const html = await new MjmlRenderer().render(
      path.join(fixturesDir, 'mjml-invalid.mjml'),
      { code: '1234' },
    );
    expect(html).toContain('<html');
  });

  it('renders a React Email default export', async () => {
    const html = await new ReactEmailRenderer().render(
      path.join(templatesFixtureDir, 'react-email-welcome', 'index.mjs'),
      { userName: 'Ada' },
    );
    expect(html).toContain('Hello Ada');
  });

  it('renders React Email source .tsx without a React import', async () => {
    const html = await new ReactEmailRenderer().render(
      path.join(templatesFixtureDir, 'react-email-welcome', 'index.tsx'),
      { userName: 'Ada' },
    );
    expect(html).toContain('Hello');
    expect(html).toContain('Ada');
  });

  it('renders a React Email named Email export', async () => {
    const html = await new ReactEmailRenderer().render(
      path.join(fixturesDir, 'react-email-named.mjs'),
      { userName: 'Ada' },
    );
    expect(html).toContain('Hello Ada');
  });

  it('throws when the module has no Email export', async () => {
    await expect(
      new ReactEmailRenderer().render(
        path.join(fixturesDir, 'react-email-missing.mjs'),
        { userName: 'Ada' },
      ),
    ).rejects.toThrow(/no default \(or Email\) export/);
  });
});
