#!/usr/bin/env node
/**
 * Live browser preview for HTML and MJML templates (Handlebars → optional MJML).
 * React Email continues to use `npm run dev` (email dev).
 */
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PAYLOADS_PATH = path.join(__dirname, 'preview-payloads.json');
const PORT = Number(process.env.PREVIEW_PORT || 10002);
const HOST = process.env.PREVIEW_HOST || '127.0.0.1';

/** @typedef {{ id: string; renderer: 'html' | 'mjml'; dir: string; sourcePath: string; relativeDir: string }} PreviewTemplate */

let revision = Date.now();
/** @type {PreviewTemplate[]} */
let templates = [];

function normalizeForSchemeCheck(value) {
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/&#x0*3a;|&#0*58;|&colon;/gi, ':');
}

function detectUnsafeUrlScheme(value) {
  const normalized = normalizeForSchemeCheck(value);
  if (normalized.startsWith('javascript:')) {
    return 'javascript';
  }
  if (normalized.startsWith('data:')) {
    return 'data';
  }
  if (normalized.startsWith('vbscript:')) {
    return 'vbscript';
  }
  return undefined;
}

function sanitizePayload(value, pathLabel = '') {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === 'string') {
    const scheme = detectUnsafeUrlScheme(value);
    if (scheme) {
      console.warn(
        `[preview] Blocked unsafe URL scheme (${scheme}) at ${pathLabel || 'value'}`,
      );
      return '';
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizePayload(item, `${pathLabel}[${String(index)}]`),
    );
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = pathLabel ? `${pathLabel}.${key}` : key;
      result[key] = sanitizePayload(child, childPath);
    }
    return result;
  }
  throw new Error(
    `Preview payload "${pathLabel || 'value'}" has unsupported type: ${typeof value}`,
  );
}

function loadPayloads() {
  if (!fs.existsSync(PAYLOADS_PATH)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(PAYLOADS_PATH, 'utf-8'));
}

function discoverTemplates() {
  /** @type {PreviewTemplate[]} */
  const found = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name.startsWith('_') ||
        entry.name === 'node_modules' ||
        entry.name === '.notifier-cache'
      ) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      /** @type {'html' | 'mjml' | null} */
      let renderer = null;
      if (entry.name === 'index.mjml') {
        renderer = 'mjml';
      } else if (entry.name === 'index.html') {
        renderer = 'html';
      }
      if (!renderer) {
        continue;
      }

      const templateDir = path.dirname(full);
      const id = path.basename(templateDir);
      found.push({
        id,
        renderer,
        dir: templateDir,
        sourcePath: full,
        relativeDir: path.relative(TEMPLATES_DIR, templateDir),
      });
    }
  }

  walk(TEMPLATES_DIR);
  found.sort((a, b) => a.id.localeCompare(b.id));
  return found;
}

async function renderTemplate(template, payloads) {
  const source = fs.readFileSync(template.sourcePath, 'utf-8');
  if (source.includes('{{{') || source.includes('{{&')) {
    throw new Error(
      'Unescaped Handlebars output is not allowed (no {{{...}}}, {{{{...}}}}, or {{&...}}). Use {{...}} so values stay HTML-escaped.',
    );
  }
  const payload = sanitizePayload(payloads[template.id] ?? {});
  const compiled = Handlebars.compile(source, {
    strict: true,
    noEscape: false,
  });
  const expanded = compiled(payload);

  if (template.renderer === 'html') {
    return expanded;
  }

  const { html, errors } = await mjml2html(expanded, {
    validationLevel: 'soft',
  });
  if (errors?.length) {
    const details = errors
      .map((err) => err.formattedMessage ?? err.message)
      .join('\n');
    console.warn(`[preview] MJML warnings for ${template.id}:\n${details}`);
  }
  return html;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function injectLiveReload(html) {
  const snippet = `
<script>
(() => {
  let revision = null;
  async function poll() {
    try {
      const res = await fetch('/api/revision');
      const data = await res.json();
      if (revision === null) {
        revision = data.revision;
      } else if (data.revision !== revision) {
        location.reload();
      }
    } catch (_) {}
    setTimeout(poll, 800);
  }
  poll();
})();
</script>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${snippet}</body>`);
  }
  return `${html}${snippet}`;
}

function renderIndexPage() {
  const rows = templates
    .map((template) => {
      const href = `/preview/${encodeURIComponent(template.id)}`;
      return `<li>
  <a href="${href}">${escapeHtml(template.id)}</a>
  <span class="meta">${escapeHtml(template.renderer)} · ${escapeHtml(template.relativeDir)}</span>
</li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HTML / MJML preview</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f4f4f5; color: #18181b; }
    main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: -0.03em; }
    p { margin: 0 0 28px; color: #52525b; line-height: 1.5; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    li { background: #fff; border-radius: 10px; padding: 14px 16px; display: flex; gap: 12px; align-items: baseline; justify-content: space-between; }
    a { color: #18181b; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #71717a; font-size: 13px; }
    .hint { margin-top: 28px; font-size: 13px; color: #71717a; }
  </style>
</head>
<body>
  <main>
    <h1>HTML / MJML preview</h1>
    <p>Handlebars + MJML preview for static templates. React Email stays on <code>npm run dev</code> (port 10001).</p>
    <ul>
      ${rows || '<li>No HTML or MJML templates found under <code>templates/</code>.</li>'}
    </ul>
    <p class="hint">Payloads: <code>scripts/preview-payloads.json</code>. Edits to templates reload automatically.</p>
  </main>
  ${injectLiveReload('')}
</body>
</html>`;
}

function refreshCatalog() {
  templates = discoverTemplates();
  revision = Date.now();
  console.log(
    `[preview] ${String(templates.length)} template(s) · revision ${String(revision)}`,
  );
}

function watchTemplates() {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounce;
  const schedule = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        refreshCatalog();
      } catch (error) {
        console.error('[preview] refresh failed:', error);
      }
    }, 150);
  };

  fs.watch(TEMPLATES_DIR, { recursive: true }, (_event, filename) => {
    if (!filename) {
      schedule();
      return;
    }
    if (filename.endsWith('.mjml') || filename.endsWith('.html')) {
      schedule();
    }
  });

  if (fs.existsSync(PAYLOADS_PATH)) {
    fs.watch(PAYLOADS_PATH, () => schedule());
  }
}

function send(res, status, body, contentType) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function notFound(res, message) {
  send(res, 404, message, 'text/plain; charset=utf-8');
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res);
});

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${HOST}:${String(PORT)}`);

  if (url.pathname === '/api/revision') {
    send(res, 200, { revision }, 'application/json; charset=utf-8');
    return;
  }

  if (url.pathname === '/api/templates') {
    send(
      res,
      200,
      templates.map((template) => ({
        id: template.id,
        renderer: template.renderer,
        path: template.relativeDir,
      })),
      'application/json; charset=utf-8',
    );
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    send(res, 200, renderIndexPage(), 'text/html; charset=utf-8');
    return;
  }

  const previewMatch = /^\/preview\/([^/]+)\/?$/.exec(url.pathname);
  if (previewMatch) {
    const id = decodeURIComponent(previewMatch[1] ?? '');
    const template = templates.find((entry) => entry.id === id);
    if (!template) {
      notFound(res, `Unknown template: ${id}`);
      return;
    }
    try {
      const payloads = loadPayloads();
      const html = injectLiveReload(await renderTemplate(template, payloads));
      send(res, 200, html, 'text/html; charset=utf-8');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to render template';
      send(
        res,
        500,
        `<!DOCTYPE html><html><body><pre>${escapeHtml(message)}</pre>${injectLiveReload('')}</body></html>`,
        'text/html; charset=utf-8',
      );
    }
    return;
  }

  notFound(res, 'Not found');
}

refreshCatalog();
watchTemplates();

if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
  console.warn(
    `[preview] PREVIEW_HOST=${HOST} is not loopback. Bind only on trusted networks.`,
  );
}

server.on('error', (error) => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  ) {
    console.error(
      `[preview] Port ${String(PORT)} is already in use. Stop the other process or set PREVIEW_PORT.`,
    );
    process.exit(1);
  }
  throw error;
});
server.listen(PORT, HOST, () => {
  console.log(`[preview] http://${HOST}:${String(PORT)}`);
  console.log(
    '[preview] React Email: npm run preview:react-email → http://127.0.0.1:10001',
  );
  console.log('[preview] Both: npm run dev');
});
