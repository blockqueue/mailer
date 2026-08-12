# BlockQueue Notifier

Self-hostable notifications API. Email renders templates (React Email, MJML, HTML) and sends via Zeptomail or SES. SMS sends via Termii (no templates).

**Private networks only.** Do not expose this on the public internet. Authenticate callers (API key or HMAC) and terminate TLS/mTLS at your ingress or mesh.

## Quick Start

```bash
docker compose up --build bq-example-notifier-service
```

Loads placeholders from [`apps/notifier/.env.example`](apps/notifier/.env.example). Copy that file for real credentials. Do not set `CONFIG_PATH` / `TEMPLATES_DIR` on the baked example image.

**Local API** (source templates from the example):

```bash
npm install
cp apps/notifier/.env.example apps/notifier/.env
npm run dev --workspace=notifier
```

Canonical consumer layout, preview, and bake steps: [examples/notifier-service](examples/notifier-service).

## Shipping templates

Bake templates into a consumer image. Volume mounts into Distroless are not supported.

```dockerfile
ARG NOTIFIER_IMAGE=ghcr.io/blockqueue/notifier:latest
FROM ${NOTIFIER_IMAGE} AS notifier

FROM node:24-alpine AS compile
WORKDIR /work
COPY --from=notifier /app/dist/compile-templates.cjs ./compile-templates.cjs
RUN npm init -y && npm install esbuild @react-email/components react react-dom
COPY ./templates /templates-src
RUN node ./compile-templates.cjs /templates-src /app/templates

FROM ${NOTIFIER_IMAGE}
COPY --from=compile /app/templates /app/templates
COPY ./config/config.yaml /config/config.yaml
```

| Source       | Runtime artifact                       |
| ------------ | -------------------------------------- |
| `index.tsx`  | `index.mjs` (`renderer: react-email`)  |
| `index.mjml` | copied; Handlebars + MJML at send time |
| `index.html` | copied; Handlebars at send time        |

| Mode       | Run                              | Loads                                                               |
| ---------- | -------------------------------- | ------------------------------------------------------------------- |
| Local API  | `npm run dev` in `apps/notifier` | Source `.tsx` / `.mjml` / `.html` (`TEMPLATES_DIR` / `CONFIG_PATH`) |
| Preview    | example `npm run dev`            | Ports 10001 (React Email) and 10002 (HTML/MJML); not the API        |
| Production | Distroless consumer image        | `index.mjs` plus source MJML/HTML                                   |

The runtime has `react`, `@react-email/render`, `handlebars`, and `mjml`. It does not include `tsx` or `@react-email/components`. Compile React Email at image build time.

## Configuration

`/config/config.yaml` (override path with `CONFIG_PATH`). Use `${VAR}` / `${VAR:-default}` in config and `template.yaml`. Only `CONFIG_PATH` and `TEMPLATES_DIR` have fixed names; everything else is whatever you reference in YAML. `PORT` defaults to `3000`.

```yaml
auth:
  type: apiKey
  header: x-notifier-api-key
  value: ${NOTIFIER_API_KEY}

email:
  accounts:
    zeptomail:
      type: zeptomail
      from: ${MAIL_FROM_EMAIL}
      apiKey: ${ZEPTOMAIL_API_KEY}
    ses:
      type: ses
      from: ${MAIL_FROM_EMAIL}
      region: ${AWS_REGION}
      accessKeyId: ${AWS_ACCESS_KEY_ID}
      secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
  defaults:
    account: zeptomail
    renderer: react-email

sms:
  accounts:
    termii:
      type: termii
      apiKey: ${TERMII_API_KEY}
      from: ${TERMII_FROM}
      version: v3 # v3 | v4
      channel: dnd # dnd | generic
      messageType: plain # plain | unicode
  defaults:
    account: termii

requestValidation:
  maxBodySize: 1048576
  maxAttachmentSize: 10485760
```

**HMAC auth** instead of API key:

```yaml
auth:
  type: hmac
  header: x-notifier-signature # optional
  secret: ${NOTIFIER_SIGNING_SECRET}
  tolerance: 300 # seconds
```

Zeptomail also accepts optional `fromName` and `bounceAddress`. Termii `version` picks `v3`/`v4` hosts; per-request `sendOptions.version` overrides unless the account sets `baseUrl` (then overrides return `400`).

## Templates

Recursive load of every `template.yaml` under `TEMPLATES_DIR` (default `/app/templates`). Nested folders are fine. Each `id` must be unique. Paths starting with `_` are skipped.

```yaml
id: welcome
renderer: react-email # or mjml | html; falls back to email.defaults.renderer
account: zeptomail # optional
from: ${TEMPLATE_FROM_EMAIL} # optional
schema:
  type: object
  required: [userName, appName]
  properties:
    userName: { type: string }
    appName: { type: string }
```

### React Email (`index.tsx`)

```tsx
import { Html, Head, Body, Container, Text } from '@react-email/components';

export default function WelcomeEmail({
  userName,
  appName,
}: {
  userName: string;
  appName: string;
}) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hello {userName}!</Text>
          <Text>Welcome to {appName}!</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### MJML / HTML (Handlebars)

```xml
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{userName}}!</mj-text>
        <mj-text>{{#if isPremium}}Thanks for upgrading.{{/if}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

- `{{value}}` is HTML-escaped. Unescaped forms (`{{{...}}}`, `{{{{...}}}}`, `{{&...}}`) are rejected.
- Missing variables → `400`. Unsafe URL schemes (`javascript:`, `data:`, `vbscript:`) in strings are blanked.
- Schemas reject unknown payload properties unless `additionalProperties: true`.

## API

Auth headers:

- API key: `x-notifier-api-key: <key>`
- HMAC: `x-notifier-signature: t=<unix-seconds>,v1=<hmac-sha512 of timestamp + "." + rawBody>`

### `POST /email/send`

```json
{
  "templateId": "welcome",
  "account": "zeptomail",
  "payload": { "userName": "John", "appName": "MyApp" },
  "sendMailOptions": {
    "to": ["user@example.com"],
    "from": "custom@example.com",
    "subject": "Welcome!",
    "cc": [],
    "bcc": [],
    "replyTo": "support@example.com",
    "attachments": []
  }
}
```

- `templateId`, `payload` required. `sendMailOptions.to` and `subject` required (`subject` may come from the template).
- Resolution: request → template → account/defaults for account, from, and related options.
- Zeptomail-only: `fromName`, `bounceAddress`. Unknown fields → `400`.
- Response: `{ "success": true, "messageId": "..." }`

### `POST /sms/send`

```json
{
  "to": "23490126727",
  "body": "Your OTP is 1234",
  "account": "termii",
  "sendOptions": {
    "version": "v4",
    "from": "MyApp",
    "channel": "dnd",
    "messageType": "plain"
  }
}
```

`to` is a string or array (max 100). No templates. Unknown `sendOptions` → `400`.

### `GET /health` / `GET /ready`

`/health` process up. `/ready` returns `503` if email is configured but no templates loaded.

### HMAC signing (Node)

```javascript
const crypto = require('crypto');

function generateSignature(secret, body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = JSON.stringify(body);
  const signature = crypto
    .createHmac('sha512', secret)
    .update(`${timestamp}.`)
    .update(bodyString)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
```

Sign the **exact** raw JSON body string you send.

## Errors

```json
{ "success": false, "message": "...", "details": ["..."] }
```

| Status | When                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| `400`  | Validation, unknown fields, missing vars, bad emails/attachments, unknown account |
| `401`  | Bad or missing auth                                                               |
| `404`  | Template not found                                                                |
| `413`  | Body over `maxBodySize`                                                           |
| `502`  | Provider failure                                                                  |
| `503`  | Channel not configured / not ready                                                |
| `500`  | Unexpected                                                                        |

## Docker

```bash
docker build -t blockqueue/notifier:latest -f docker/notifier/Dockerfile.prod .
```

Distroless (`gcr.io/distroless/nodejs24-debian12:nonroot`): API bundle, `compile-templates.cjs`, and runtime peers from [`docker/notifier/package.runtime.json`](docker/notifier/package.runtime.json). No shell/`tsx`/`@react-email/components`.

```bash
docker compose build
docker compose up bq-example-notifier-service
```

Template changes need a new image build.

## Development

```
apps/notifier/          # API
examples/notifier-service/  # config + templates + consumer Dockerfile
docker/notifier/        # production runtime image
```

```bash
npm run lint
npm test --workspace=notifier
```
