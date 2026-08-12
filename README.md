# BlockQueue Notifier

A self-hostable notification API for email and SMS. Email requests render templates and send via Zeptomail or SES; SMS sends via Termii (no templates).

> **Internal use only.** This service is designed to run on a private network (VPC, Docker Swarm overlay, Kubernetes cluster network, etc.). Do **not** expose it directly on the public internet. Put it behind your internal mesh, reverse proxy, or service discovery, and restrict callers to trusted backends.

## About This Project

This notifier service was developed by [BlockQueue](https://blockqueue.io) as infrastructure to support our other projects that need email and SMS delivery, without building that functionality into each project. We've open sourced it for the community to use and benefit from.

**Why we built it:**

- Centralized notification infrastructure for multiple BlockQueue products
- Consistent email and SMS delivery across our ecosystem
- Separation of concerns - notification logic separate from application logic
- Reusable across different projects with different requirements

**Why we open sourced it:**

- Share quality infrastructure with the developer community
- Build trust and showcase BlockQueue's engineering capabilities
- Enable community contributions and improvements
- Help others who need self-hosted notification solutions

This is infrastructure software, not a standalone product. We focus on making it reliable, well-documented, and easy to use for both our internal needs and the open source community.

## Features

- **Multiple Renderers**: Support for React Email, MJML, and HTML templates
- **Email + SMS**: Zeptomail / AWS SES for email; Termii (API v3/v4) for SMS
- **YAML Configuration**: Configuration files with environment variable substitution
- **Template Validation**: Templates are validated at startup with JSON Schema
- **Email Validation**: Automatic validation of all email addresses (from, to, cc, bcc, replyTo)
- **Authentication**: API key or HMAC request signing
- **Docker Ready**: Slim runtime image; compile templates in your consumer Dockerfile (see [examples/notifier-service](examples/notifier-service))

## Table of Contents

- [Quick Start](#quick-start)
- [Shipping your own templates](#shipping-your-own-templates)
- [Configuration](#configuration)
- [Templates](#templates)
- [API Reference](#api-reference)
- [Email Validation](#email-validation)
- [Error Handling](#error-handling)
- [Development](#development)

## Quick Start

### Using Docker Compose

The repo includes a working example under [examples/notifier-service](examples/notifier-service). From the repo root:

```bash
docker compose build
docker compose up bq-example-notifier-service
```

Replace the demo secrets in `docker-compose.yml` before deploying anywhere outside local development.

That builds the slim notifier runtime plus a consumer image with compiled templates and example config. For a minimal hand-rolled setup:

1. Create a `config` directory with `config.yaml`:

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
  defaults:
    account: zeptomail
    renderer: react-email

sms:
  accounts:
    termii:
      type: termii
      apiKey: ${TERMII_API_KEY}
      from: ${TERMII_FROM}
      version: v3
  defaults:
    account: termii
```

2. Create a `templates` directory with your templates (see [Templates](#templates) section)

3. Set environment variables (note: variable names should match what you use in your `config.yaml`):

```bash
export NOTIFIER_API_KEY=your-api-key
export MAIL_FROM_EMAIL=noreply@example.com
export ZEPTOMAIL_API_KEY=your-zeptomail-key
```

**Note**: All environment variables are optional. You only need to set the variables that you reference in your `config.yaml` file. Variable names are user-defined - use whatever names you prefer in your config.

4. Run with Docker Compose:

```bash
docker-compose up
```

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy `apps/notifier/.env.example` to `apps/notifier/.env` (points at [examples/notifier-service](examples/notifier-service) config and templates by default)

3. Set any provider secrets you reference in that config

4. Run the server:

```bash
npm run dev --workspace=notifier
```

The server will start on port 3000 (or the port specified by `PORT` environment variable).

For a production-like Docker run with compiled templates, see [examples/notifier-service](examples/notifier-service).

## Shipping your own templates

**Canonical guide:** [examples/notifier-service](examples/notifier-service) — bake your templates into a consumer image. Volume-mounting templates into Distroless is not supported.

Authors keep editable source under `templates/` (`.tsx` / `.mjml` / `.html`) and preview with React Email. When ready to ship, the consumer Dockerfile compiles templates into the slim notifier image:

```dockerfile
ARG NOTIFIER_IMAGE=ghcr.io/blockqueue/notifier:latest
FROM ${NOTIFIER_IMAGE} AS notifier

FROM node:24-alpine AS compile
WORKDIR /work
COPY --from=notifier /app/dist/compile-templates.mjs ./compile-templates.mjs
RUN npm init -y && npm install esbuild mjml @react-email/components react react-dom
COPY ./templates /templates-src
RUN node ./compile-templates.mjs /templates-src /app/templates

FROM ${NOTIFIER_IMAGE}
COPY --from=compile /app/templates /app/templates
COPY ./config/config.yaml /config/config.yaml
```

Templates land under **`/app/templates`** so Node resolves `react` / `@react-email/render` from `/app/node_modules` without a symlink.

| Source                    | Compiled artifact                                      |
| ------------------------- | ------------------------------------------------------ |
| `index.tsx` (React Email) | `index.mjs` + `renderer: react-email` in template.yaml |
| `index.mjml`              | `index.html` + `renderer: html`                        |
| `index.html`              | copied as-is + `renderer: html`                        |

### Development vs production templates

| Environment          | How you run                                                         | What loads                                                              |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Local API**        | `npm run dev` in `apps/notifier` (`NODE_ENV=development` + **tsx**) | Source `index.tsx` / `index.mjml` (set `TEMPLATES_DIR` / `CONFIG_PATH`) |
| **Template preview** | `npm run dev` in your consumer (`email dev`)                        | React Email preview only — not the notifier API                         |
| **Production image** | Distroless final stage                                              | **Compiled** `index.mjs` / `index.html` only                            |

The Distroless runtime does **not** include `tsx`, `mjml`, or `@react-email/components`. Do not set `NODE_ENV=development` on the baked image expecting raw `.tsx` to work — compile at image build time instead. Distroless is for the **final** image only; compilation uses a normal Node stage.

## Configuration

### Global Config (`/config/config.yaml`)

The global configuration file defines shared authentication plus channel-specific `email` and `sms` sections.

#### Example Config

**API Key Authentication:**

```yaml
auth:
  type: apiKey
  header: x-notifier-api-key
  value: ${NOTIFIER_API_KEY}
```

**HMAC Request Signing:**

```yaml
auth:
  type: hmac
  header: x-notifier-signature # Optional, defaults to 'x-notifier-signature'
  secret: ${NOTIFIER_SIGNING_SECRET}
  tolerance: 300 # Timestamp tolerance in seconds (default: 300 = 5 minutes)

# Optional: Request validation settings
requestValidation:
  maxBodySize: 1048576 # Maximum request body size in bytes (default: 1048576 = 1MB)
  maxAttachmentSize: 10485760 # Per-attachment limit in bytes (default: 10MB)
  allowedAttachmentMimeTypes: # Optional allowlist (defaults to common pdf/image/text types)
    - application/pdf
    - image/png
```

**Full Example:**

```yaml
auth:
  type: hmac
  header: x-notifier-signature
  secret: ${NOTIFIER_SIGNING_SECRET}
  tolerance: 300

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
      version: v3
      channel: dnd
      messageType: plain
  defaults:
    account: termii

requestValidation:
  maxBodySize: 1048576
  maxAttachmentSize: 10485760
```

#### Environment Variable Substitution

Use `${VAR_NAME}` or `${VAR_NAME:-default}` syntax in your YAML config files (both `config.yaml` and `template.yaml`):

```yaml
auth:
  value: ${NOTIFIER_API_KEY}  # Required, will error if not set
  value: ${NOTIFIER_API_KEY:-default-key}  # Optional, uses default if not set
```

**Important Notes:**

- **All environment variables are optional** - You only need to set the variables that you reference in your `config.yaml` or `template.yaml` files
- **Variable names are user-defined** - You can use any variable names you want in your config (e.g., `${MY_API_KEY}`, `${EMAIL_USER}`, etc.)
- **Only two environment variables have fixed names**: `CONFIG_PATH` and `TEMPLATES_DIR` (see [Environment Variables](#environment-variables) section)
- All other environment variable names are determined by what you write in your `config.yaml` or `template.yaml` files
- **Environment variable substitution works in both `config.yaml` and `template.yaml` files** - Use the same `${VAR_NAME}` syntax in both

### Account Types

#### Email: Zeptomail

```yaml
email:
  accounts:
    zeptomail:
      type: zeptomail
      from: noreply@example.com
      fromName: MyApp # Optional display name
      apiKey: ${ZEPTOMAIL_API_KEY}
      bounceAddress: ${ZEPTOMAIL_BOUNCE_ADDRESS} # Optional
```

#### Email: Amazon SES

```yaml
email:
  accounts:
    ses:
      type: ses
      from: noreply@example.com
      region: us-east-1
      accessKeyId: ${AWS_ACCESS_KEY_ID}
      secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
```

#### SMS: Termii

```yaml
sms:
  accounts:
    termii:
      type: termii
      apiKey: ${TERMII_API_KEY}
      from: MyApp # sender ID
      version: v3 # v3 | v4
      # baseUrl: https://v3.api.termii.com
      channel: dnd # dnd | generic
      messageType: plain # plain | unicode
```

`version` selects `https://v3.api.termii.com` or `https://v4.api.termii.com`. Per-request `sendOptions.version` overrides the account default. If the account sets `baseUrl`, that URL is used and `sendOptions.version` is rejected (400).

## Templates

**Source** (authoring): directories under your consumer `templates/` folder.
**Runtime** (baked image): compiled artifacts under `/app/templates/` (default `TEMPLATES_DIR`).

The loader recursively finds every `template.yaml` under the templates directory. Nested folders are supported. Each template `id` must be **unique** across the tree (directory name no longer has to match `id`). Path segments starting with `_` (e.g. `_components`) are skipped.

Each template directory (the folder containing `template.yaml`) has:

1. `template.yaml` - Template metadata and schema
2. Template file — source: `index.tsx` / `index.mjml` / `index.html`; production: `index.mjs` and/or `index.html`

### Template Config (`template.yaml`)

```yaml
id: welcome
renderer: react-email
account: zeptomail # Optional: default account for this template
from: ${TEMPLATE_FROM_EMAIL} # Optional: default 'from' address (supports env vars)
schema:
  type: object
  required:
    - userName
    - appName
  properties:
    userName:
      type: string
    appName:
      type: string
```

**Template Config Fields:**

- `id` (required): Unique template identifier (across the whole templates tree)
- `renderer` (optional): Template renderer type (`react-email`, `mjml`, or `html`). Falls back to `email.defaults.renderer`.
- `account` (optional): Default email account for this template. Falls back to `email.defaults.account`.
- `from` (optional): Default 'from' email address for this template. Falls back to `account.from` if not provided.
- `schema` (required): JSON Schema for payload validation

**Environment Variable Substitution:**

Template YAML files support environment variable substitution using the same syntax as `config.yaml`:

- `${VAR_NAME}` - Required variable (will error if not set)
- `${VAR_NAME:-default}` - Optional variable with default value

**Example:**

```yaml
id: welcome
renderer: react-email
account: ${TEMPLATE_ACCOUNT:-zeptomail}
from: ${TEMPLATE_FROM_EMAIL:-noreply@example.com}
schema:
  # ...
```

**Note**: All environment variables are optional. You only need to set the variables that you reference in your `template.yaml` files. Variable names are user-defined - use whatever names you prefer in your templates.

### React Email Template (`index.tsx`)

Production compile uses the automatic JSX runtime (`index.mjs`). Local `npm run dev` loads source `.tsx` via tsx when `NODE_ENV=development`.

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

See [examples/notifier-service](examples/notifier-service) for the full author → preview → Docker compile workflow.

### MJML Template (`index.mjml`)

```xml
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{userName}}!</mj-text>
        <mj-text>Welcome to {{appName}}!</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

Variables in MJML templates use `{{variableName}}` syntax.

### HTML Template (`index.html`)

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Hello {{userName}}!</h1>
    <p>Welcome to {{appName}}!</p>
  </body>
</html>
```

Variables in HTML templates use `{{variableName}}` syntax.

## API Reference

### POST /email/send

Send an email using a template.

#### Headers

**API Key Authentication:**

```
x-notifier-api-key: <your-api-key>
```

**HMAC Request Signing:**

```
x-notifier-signature: t=<timestamp>,v1=<signature>
```

The signature header format is `t=<timestamp>,v1=<signature>` where:

- `timestamp` is the current Unix timestamp in **seconds** (e.g., `Math.floor(Date.now() / 1000)`)
- `signature` is the HMAC-SHA512 hash of `timestamp + "." + requestBody` using your signing secret

**Client Implementation Example (Node.js):**

```javascript
const crypto = require('crypto');

function generateSignature(secret, body) {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const bodyString = JSON.stringify(body); // Raw request body as string

  // Signature is: HMAC-SHA512(timestamp + "." + bodyString, secret)
  const signature = crypto
    .createHmac('sha512', secret)
    .update(`${timestamp}.`)
    .update(bodyString)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

const body = { templateId: 'welcome', payload: {...} };
const bodyString = JSON.stringify(body);
const signature = generateSignature(process.env.NOTIFIER_SIGNING_SECRET, body);

fetch('https://notifier.example.com/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-notifier-signature': signature,
  },
  body: JSON.stringify(body),
});
```

**Postman Pre-Request Script:**

For testing with Postman, add this script to the "Pre-request Script" tab:

```javascript
const secret = pm.environment.get('NOTIFIER_SIGNING_SECRET');
if (!secret) {
  throw new Error('NOTIFIER_SIGNING_SECRET is required.');
}

const bodyString = pm.request.body.raw;
if (!bodyString) {
  throw new Error('Request body is required for HMAC signing');
}

const timestamp = Math.floor(Date.now() / 1000);
const message = `${timestamp}.${bodyString}`;

const encoder = new TextEncoder();
const keyData = encoder.encode(secret);
const messageData = encoder.encode(message);

const key = await crypto.subtle.importKey(
  'raw',
  keyData,
  { name: 'HMAC', hash: { name: 'SHA-512' } },
  false,
  ['sign'],
);

const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
const signature = Array.from(new Uint8Array(signatureBuffer))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

pm.request.headers.upsert({
  key: 'x-notifier-signature',
  value: `t=${timestamp},v1=${signature}`,
});
```

Use top-level `await` so signing finishes before the request is sent (Postman v10+).

**Setup:**

1. Set an environment variable: `NOTIFIER_SIGNING_SECRET = "your-secret-key"`
2. Paste the script into the "Pre-request Script" tab
3. Make sure your request body is set to "raw" with "JSON" format

#### Request Body

```json
{
  "templateId": "welcome",
  "account": "zeptomail",
  "payload": {
    "userName": "John",
    "appName": "MyApp"
  },
  "sendMailOptions": {
    "to": ["user@example.com", "another@example.com"],
    "from": "custom@example.com",
    "subject": "Welcome to MyApp!",
    "cc": ["cc@example.com"],
    "bcc": ["bcc@example.com"],
    "replyTo": "support@example.com",
    "attachments": []
  }
}
```

**Request Fields:**

- `templateId` (required): The template ID to use
- `account` (optional): Account to use. Falls back to `template.account` or `email.defaults.account`
- `payload` (required): Data to pass to the template (must match template schema)
- `sendMailOptions` (optional): Email sending options
  - `to` (required): Recipient email address(es) - string or array of strings
  - `from` (optional): Sender email address. Falls back to `template.from` > `account.from` if not provided
  - `subject` (required unless set on the template): Email subject
  - `cc` (optional): CC recipient(s) - string or array of strings
  - `bcc` (optional): BCC recipient(s) - string or array of strings
  - `replyTo` (optional): Reply-to email address
  - `attachments` (optional): Array of attachment objects
  - Provider-specific extras may be accepted depending on the account type

**Note**: The `to` field accepts either a single email string or an array of email addresses for multiple recipients.

#### Response

```json
{
  "messageId": "<message-id>",
  "success": true
}
```

#### Resolution Priority

The system resolves configuration values in the following priority order:

- **Account**: `request.account` > `template.account` > `email.defaults.account`
- **Renderer**: `template.renderer` > `email.defaults.renderer`
- **From**: `request.sendMailOptions.from` > `template.from` > `account.from`
- **Other sendMailOptions**: `request.sendMailOptions.*` > `template.*` > `account.*`

### POST /sms/send

Send an SMS via a configured SMS account (Termii). No templates.

#### Request Body

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

**Request Fields:**

- `to` (required): Destination phone number(s) in international format (string or array, max 100)
- `body` (required): Message text
- `account` (optional): SMS account id; falls back to `sms.defaults.account`
- `sendOptions` (optional):
  - `version` (`v3` | `v4`): Termii API host; overrides account `version` (rejected if account `baseUrl` is set)
  - `from`: sender ID override
  - `channel`: `dnd` | `generic`
  - `messageType`: `plain` | `unicode`

#### Response

```json
{
  "success": true,
  "messageId": "<termii-message-id>"
}
```

### GET /health

Health check endpoint (process is up).

#### Response

```json
{
  "status": "ok"
}
```

### GET /ready

Readiness check. Returns `503` when the email channel is configured but no templates are loaded.

#### Response

```json
{
  "status": "ok"
}
```

## Email Validation

All email addresses are automatically validated before sending:

- **Required fields**: `from` and `to` are required (validation will fail if missing)
- **Optional fields**: `cc`, `bcc`, and `replyTo` are optional but validated if provided
- **Format validation**: All email addresses are validated using Zod's email validator
- **Error messages**: Clear error messages indicate which email addresses are invalid

**Example validation error:**

```json
{
  "success": false,
  "message": "Email validation failed: Invalid 'cc' addresses: invalid-email, another-invalid"
}
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "details": ["Additional error details"]
}
```

`details` is optional (for example payload validation failures).

### HTTP Status Codes

- `400` - Bad Request
  - Missing required fields (`templateId`, `payload`, `to`, `body`, etc.)
  - Payload validation failed (doesn't match template schema)
  - Email validation failed (invalid email addresses)
  - No account specified and no default account configured
  - Unknown email/SMS account id
- `401` - Unauthorized
  - Invalid or missing API key or HMAC signature
- `404` - Not Found
  - Template not found
- `413` - Payload Too Large
  - Request body exceeds `requestValidation.maxBodySize`
- `502` - Bad Gateway
  - Email or SMS provider failure
- `503` - Service Unavailable
  - Email or SMS channel not configured
- `500` - Internal Server Error
  - Template rendering errors
  - Other unexpected server errors

### Common Error Scenarios

**Missing required field:**

```json
{
  "success": false,
  "message": "Missing required field: templateId"
}
```

**Template not found:**

```json
{
  "success": false,
  "message": "Template not found: welcome"
}
```

**Payload validation failed:**

```json
{
  "success": false,
  "message": "Payload validation failed",
  "details": ["userName: Required", "appName: Required"]
}
```

**Email validation failed:**

```json
{
  "success": false,
  "message": "Email validation failed: Invalid 'to' addresses: invalid-email"
}
```

**Missing required email field:**

```json
{
  "success": false,
  "message": "Missing required field: from"
}
```

## Security Features

This service is intended for **private networks only**. Do not publish it to the public internet. Prefer network isolation (VPC, overlay network, cluster-internal Service) plus authentication below. If you need encryption or peer identity between internal services, terminate TLS or use **mTLS** at your ingress / service mesh — not in this application.

### Authentication

The service supports two authentication methods:

1. **API Key**: Simple shared-secret header (fine for trusted internal callers)
2. **HMAC Request Signing**: Signed requests with timestamp tolerance (stronger integrity / replay protection)

HMAC authentication provides:

- Request integrity verification
- Replay attack prevention (via timestamp tolerance)
- No token storage required

### Request Validation

- Body size limit: 1MB default (configurable via `requestValidation.maxBodySize`)
- Attachment size and MIME allowlist (configurable via `requestValidation.maxAttachmentSize` and `allowedAttachmentMimeTypes`)
- Content-Type validation: Requires `application/json` for POST requests

**Configuration:**

```yaml
requestValidation:
  maxBodySize: 1048576 # Maximum request body size in bytes (default: 1048576 = 1MB)
  maxAttachmentSize: 10485760 # Per attachment (default: 10MB)
  allowedAttachmentMimeTypes:
    - application/pdf
    - image/png
```

The `maxBodySize` is specified in bytes. Common values:

- `1048576` = 1MB (default)
- `2097152` = 2MB
- `5242880` = 5MB

### Audit Logging

All requests are logged with:

- Timestamp
- Endpoint and method
- Status code
- Response time
- Request size
- Template ID / account ID (when present on send requests)

Special logging for:

- Failed authentication attempts
- Large requests (>100KB)
- Slow requests:
  - `/email/send` and `/sms/send`: >10 seconds (sending via external providers typically takes 1-5 seconds)
  - Other endpoints: >1 second

**PII Handling:** Email addresses and payload content are not logged - only metadata (template ID, account ID, etc.) is recorded.

## Development

### Project Structure

```
apps/notifier/
  src/
    controllers/          # Route handlers
      email.controller.ts
    index.ts              # Main app entry point (route definitions)
    middleware/           # Middleware
      auth.ts
    services/             # Business logic services
      email/              # Email sending service
        send.ts
        ses-client.ts
        zeptomail-client.ts
      sms/                # SMS sending service (Termii)
        termii-client.ts
        send.ts
      renderer/           # Template renderers
        html.ts
        index.ts
        mjml.ts
        react-email.ts
    types/                # TypeScript type definitions
      config.ts
      request.ts
      template.ts
    utils/                # Utility functions
      loaders/            # Configuration and template loaders
        config.loader.ts
        template.loader.ts
        yaml.loader.ts
      schema/             # Schema utilities
        json-schema-to-zod.ts
      template/            # Template utilities
        template-path.ts
      validation/          # Validation utilities
        email.ts
        payload.ts
  data/
    config/
      config.yaml
    templates/
      welcome-*/          # Template directories
```

### Adding a New Renderer

1. Create a new renderer class implementing the `Renderer` interface in `src/services/renderer/`
2. Add it to the renderer factory in `src/services/renderer/index.ts`
3. Update the `RendererType` type in `src/types/template.ts`

### Environment Variables

**All environment variables are optional**, and you can name them whatever you want based on your `config.yaml` file. The only exceptions are:

- `CONFIG_PATH` - Path to config file (default: `/config/config.yaml`)
- `TEMPLATES_DIR` - Path to templates directory (default: `/app/templates`)

**Note**: Baked consumer images use the defaults (`/config/config.yaml` and `/app/templates`). Override these only for local API development (e.g. point `TEMPLATES_DIR` at your `templates/` folder). Do not volume-mount templates into the Distroless runtime — bake a new image when templates change.

**All other environment variables** are user-defined based on what you reference in your `config.yaml` using the `${VAR_NAME}` syntax. For example, if your config uses `${MY_CUSTOM_API_KEY}`, then you would set the `MY_CUSTOM_API_KEY` environment variable.

**Common examples** (these names are just examples - use whatever names you prefer):

- `${NOTIFIER_API_KEY}` / `${NOTIFIER_SIGNING_SECRET}` - Auth credentials
- `${MAIL_FROM_EMAIL}` - Default sender address
- `${ZEPTOMAIL_API_KEY}` - Zeptomail API key
- `${AWS_REGION}` / `${AWS_ACCESS_KEY_ID}` / `${AWS_SECRET_ACCESS_KEY}` - SES credentials
- `PORT` - Server port (default: 3000) — used by the process, not via config.yaml substitution

### Linting

```bash
npm run lint
```

## Docker

### Building the slim notifier runtime

```bash
docker build -t blockqueue/notifier:latest -f docker/notifier/Dockerfile.prod .
```

The runtime image is based on **Google Distroless** (`gcr.io/distroless/nodejs24-debian12:nonroot`) — no shell, npm, or yarn. It includes the Hono API bundle (`dist/index.cjs`), `compile-templates.mjs`, and only the peers pinned in [`docker/notifier/package.runtime.json`](docker/notifier/package.runtime.json) (`react` / `react-dom` / `@react-email/render`). Runtime deps are installed on Debian (glibc) before copying into Distroless. It does **not** include `tsx`, `mjml`, or `@react-email/components`.

(Chainguard’s public `node` image was evaluated; Distroless was smaller.)

### Shipping templates

Bake compiled templates into a consumer image — see [examples/notifier-service](examples/notifier-service):

```bash
docker compose build bq-notifier-build
docker compose up bq-example-notifier-service
```

Template changes require a new image build. Volume mounts are not supported for Distroless.
