# Self-Hosted Mailing Service

A self-hostable email orchestration API that receives HTTP requests, renders emails using pluggable renderers, and sends via configurable nodemailer transports.

## Features

- **Multiple Renderers**: Support for React Email, MJML, and HTML templates
- **Flexible Transports**: Support for all nodemailer transport types (SMTP, Sendmail, SES, Stream, custom)
- **YAML Configuration**: Configuration files with environment variable substitution
- **Template Validation**: Templates are validated at startup with JSON Schema
- **Email Validation**: Automatic validation of all email addresses (from, to, cc, bcc, replyTo)
- **API Key Authentication**: Simple API key-based authentication
- **Docker Ready**: Single container image with volume mounts for config and templates

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Templates](#templates)
- [API Reference](#api-reference)
- [Email Validation](#email-validation)
- [Error Handling](#error-handling)
- [Development](#development)

## Quick Start

### Using Docker Compose

1. Create a `config` directory with `config.yaml`:

```yaml
auth:
  type: apiKey
  header: x-mailer-api-key
  value: ${MAILER_API_KEY}

accounts:
  primary:
    type: smtp
    from: ${MAIL_FROM_EMAIL}
    host: smtp.example.com
    port: 587
    secure: false
    auth:
      user: ${SMTP_USER}
      pass: ${SMTP_PASSWORD}

defaults:
  account: primary
  renderer: react-email
```

2. Create a `templates` directory with your templates (see [Templates](#templates) section)

3. Set environment variables:

```bash
export MAILER_API_KEY=your-api-key
export MAIL_FROM_EMAIL=noreply@example.com
export SMTP_USER=your-email@example.com
export SMTP_PASSWORD=your-password
```

4. Run with Docker Compose:

```bash
docker-compose up
```

### Local Development

1. Install dependencies:

```bash
bun install
```

2. Create `/data/config/config.yaml` and `/data/templates/` directory structure

3. Set environment variables (see above)

4. Run the server:

```bash
bun run dev
```

The server will start on port 3000 (or the port specified by `PORT` environment variable).

## Configuration

### Global Config (`/config/config.yaml`)

The global configuration file defines authentication, email accounts, and defaults.

#### Example Config

```yaml
auth:
  type: apiKey
  header: x-mailer-api-key
  value: ${MAILER_API_KEY}

accounts:
  primary:
    type: smtp
    from: ${MAIL_FROM_EMAIL}  # Fallback 'from' address for this account
    host: smtp.gmail.com
    port: 587
    secure: false
    auth:
      user: ${SMTP_USER}
      pass: ${SMTP_PASSWORD}

  ses:
    type: smtp
    from: ${MAIL_FROM_EMAIL}
    host: smtp.zeptomail.com
    port: 587
    secure: false
    auth:
      user: ${SMTP_USER}
      pass: ${SMTP_PASSWORD}

defaults:
  account: primary
  renderer: react-email
```

#### Environment Variable Substitution

Use `${VAR_NAME}` or `${VAR_NAME:-default}` syntax in your YAML config:

```yaml
auth:
  value: ${MAILER_API_KEY}  # Required, will error if not set
  value: ${MAILER_API_KEY:-default-key}  # Optional, uses default if not set
```

### Account Types

#### SMTP

```yaml
accounts:
  smtp-account:
    type: smtp
    from: noreply@example.com  # Optional: fallback 'from' address
    host: smtp.example.com
    port: 587
    secure: false  # true for 465, false for other ports
    auth:
      user: ${SMTP_USER}
      pass: ${SMTP_PASSWORD}
    # Any other nodemailer SMTP options can be added here
```

#### Sendmail

```yaml
accounts:
  sendmail-account:
    type: sendmail
    path: /usr/sbin/sendmail
    # Any other nodemailer sendmail options
```

#### Amazon SES

```yaml
accounts:
  ses-account:
    type: ses
    region: us-east-1
    # Any other nodemailer SES options
```

#### Stream

```yaml
accounts:
  stream-account:
    type: stream
    # Any other nodemailer stream options
```

## Templates

Templates are organized in directories under `/templates/`. Each template directory contains:

1. `template.yaml` - Template metadata and schema
2. Template file - `index.tsx` (React Email), `index.mjml` (MJML), or `index.html` (HTML)

### Template Config (`template.yaml`)

```yaml
id: welcome
renderer: react-email
defaultAccount: primary  # Optional: default account for this template
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
- `id` (required): Unique template identifier (must match directory name)
- `renderer` (optional): Template renderer type (`react-email`, `mjml`, or `html`). Falls back to global default.
- `defaultAccount` (optional): Default account to use for this template. Falls back to global default.
- `schema` (required): JSON Schema for payload validation

### React Email Template (`index.tsx`)

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

### POST /send

Send an email using a template.

#### Headers

```
x-mailer-api-key: <your-api-key>
```

#### Request Body

```json
{
  "templateId": "welcome",
  "account": "primary",
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
- `account` (optional): Account to use. Falls back to `template.defaultAccount` or `config.defaults.account`
- `payload` (required): Data to pass to the template (must match template schema)
- `sendMailOptions` (optional): Email sending options
  - `to` (required): Recipient email address(es) - string or array of strings
  - `from` (optional): Sender email address. Falls back to `account.from` if not provided
  - `subject` (optional): Email subject
  - `cc` (optional): CC recipient(s) - string or array of strings
  - `bcc` (optional): BCC recipient(s) - string or array of strings
  - `replyTo` (optional): Reply-to email address
  - `attachments` (optional): Array of attachment objects (nodemailer format)
  - Any other [nodemailer sendMail options](https://nodemailer.com/message/)

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

- **Account**: `request.account` > `template.defaultAccount` > `config.defaults.account`
- **Renderer**: `template.renderer` > `config.defaults.renderer`
- **Email Options**: `request.sendMailOptions` > `account.from` (for `from` field only)

**Email Options Merge:**
1. `account.from` is used as fallback for the `from` field if not provided in `request.sendMailOptions`
2. All other fields (`to`, `subject`, `cc`, `bcc`, `replyTo`, etc.) must be provided in `request.sendMailOptions` if needed

### GET /health

Health check endpoint.

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
  "error": "Email validation failed: Invalid 'cc' addresses: invalid-email, another-invalid"
}
```

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "details": ["Additional error details"]  // Optional, for validation errors
}
```

### HTTP Status Codes

- `400` - Bad Request
  - Missing required fields (`templateId`, `payload`, `to`)
  - Payload validation failed (doesn't match template schema)
  - Email validation failed (invalid email addresses)
  - No account specified and no default account configured
- `401` - Unauthorized
  - Invalid or missing API key
- `404` - Not Found
  - Template not found
  - Account not found
- `500` - Internal Server Error
  - Template rendering errors
  - SMTP/transport errors
  - Other server errors

### Common Error Scenarios

**Missing required field:**
```json
{
  "error": "Missing required field: templateId"
}
```

**Template not found:**
```json
{
  "error": "Template not found: welcome"
}
```

**Payload validation failed:**
```json
{
  "error": "Payload validation failed",
  "details": [
    "userName: Required",
    "appName: Required"
  ]
}
```

**Email validation failed:**
```json
{
  "error": "Email validation failed: Invalid 'to' addresses: invalid-email"
}
```

**Missing required email field:**
```json
{
  "error": "Missing required field: 'from' in sendMailOptions. Provide it in request.sendMailOptions or account.from (for 'from' field only)"
}
```

## Development

### Project Structure

```
apps/mailer/
  src/
    controllers/          # Route handlers
      email.controller.ts
    index.ts              # Main app entry point (route definitions)
    middleware/           # Middleware
      auth.ts
    services/             # Business logic services
      mailer/             # Email sending service
        send.ts
        transport.ts
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

Common environment variables:

- `MAILER_API_KEY` - API key for authentication
- `MAIL_FROM_EMAIL` - Default sender email address
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `PORT` - Server port (default: 3000)
- `CONFIG_PATH` - Path to config file (default: `/config/config.yaml`)
- `TEMPLATES_DIR` - Path to templates directory (default: `/templates`)

### Running Tests

```bash
bun test
```

### Linting

```bash
bun run lint
```

## Docker

### Building

```bash
docker build -t mailer -f docker/mailer/Dockerfile .
```

### Running

```bash
docker run -p 3000:3000 \
  -v $(pwd)/data/config:/config \
  -v $(pwd)/data/templates:/templates \
  -e MAILER_API_KEY=your-key \
  -e MAIL_FROM_EMAIL=noreply@example.com \
  -e SMTP_USER=your-user \
  -e SMTP_PASSWORD=your-password \
  mailer
```

## License

MIT
