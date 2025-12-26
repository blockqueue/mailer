# BlockQueue Mailer

A self-hostable email orchestration API that receives HTTP requests, renders emails using pluggable renderers, and sends via configurable nodemailer transports.

## About This Project

This mailer service was developed by [BlockQueue](https://blockqueue.io) as infrastructure to support our other projects that need email delivery capabilities, without building email functionality directly into each project. We've open sourced it for the community to use and benefit from.

**Why we built it:**

- Centralized email infrastructure for multiple BlockQueue products
- Consistent email delivery across our ecosystem
- Separation of concerns - email logic separate from application logic
- Reusable across different projects with different requirements

**Why we open sourced it:**

- Share quality infrastructure with the developer community
- Build trust and showcase BlockQueue's engineering capabilities
- Enable community contributions and improvements
- Help others who need self-hosted email solutions

This is infrastructure software, not a standalone product. We focus on making it reliable, well-documented, and easy to use for both our internal needs and the open source community.

## Features

- **Multiple Renderers**: Support for React Email, MJML, and HTML templates
- **Flexible Transports**: Support for all nodemailer transport types (SMTP, Sendmail, SES, Stream, custom)
- **YAML Configuration**: Configuration files with environment variable substitution
- **Template Validation**: Templates are validated at startup with JSON Schema
- **Email Validation**: Automatic validation of all email addresses (from, to, cc, bcc, replyTo)
- **Authentication**: API key or HMAC request signing authentication
- **Security Features**: Optional IP allowlisting, rate limiting, HTTPS enforcement
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

3. Set environment variables (note: variable names should match what you use in your `config.yaml`):

```bash
export MAILER_API_KEY=your-api-key
export MAIL_FROM_EMAIL=noreply@example.com
export SMTP_USER=your-email@example.com
export SMTP_PASSWORD=your-password
```

**Note**: All environment variables are optional. You only need to set the variables that you reference in your `config.yaml` file. Variable names are user-defined - use whatever names you prefer in your config.

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

3. Set environment variables (optional - only set the variables you reference in your `config.yaml` file)

4. Run the server:

```bash
bun run dev
```

The server will start on port 3000 (or the port specified by `PORT` environment variable).

## Configuration

### Global Config (`/config/config.yaml`)

The global configuration file defines authentication, email accounts, and defaults.

#### Example Config

**API Key Authentication:**

```yaml
auth:
  type: apiKey
  header: x-mailer-api-key
  value: ${MAILER_API_KEY}
```

**HMAC Request Signing (Recommended for public internet):**

```yaml
auth:
  type: hmac
  header: x-mailer-signature # Optional, defaults to 'x-mailer-signature'
  secret: ${MAILER_SIGNING_SECRET}
  tolerance: 300 # Timestamp tolerance in seconds (default: 300 = 5 minutes)

# Optional: IP allowlisting
ipAllowlist:
  enabled: true
  allowedIps:
    - 192.168.1.0/24 # CIDR notation
    - 10.0.0.1 # Single IP

# Optional: Rate limiting (user-configurable limits, strongly recommend IP allowlisting if you want to use rate limiting)
rateLimit:
  enabled: true
  maxRequests: 100 # User-defined based on their usage
  windowMinutes: 1
  maxRequestsPerHour: 1000 # User-defined based on their usage
  windowHours: 1

# Optional: Request validation settings
requestValidation:
  maxBodySize: 1048576 # Maximum request body size in bytes (default: 1048576 = 1MB)
```

**Full Example:**

```yaml
auth:
  type: hmac
  header: x-mailer-signature
  secret: ${MAILER_SIGNING_SECRET}
  tolerance: 300 # 5 minutes in seconds

accounts:
  primary:
    type: smtp
    from: ${MAIL_FROM_EMAIL} # Fallback 'from' address for this account
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

# Optional: Request validation settings
requestValidation:
  maxBodySize: 1048576 # Maximum request body size in bytes (default: 1048576 = 1MB)
```

#### Environment Variable Substitution

Use `${VAR_NAME}` or `${VAR_NAME:-default}` syntax in your YAML config files (both `config.yaml` and `template.yaml`):

```yaml
auth:
  value: ${MAILER_API_KEY}  # Required, will error if not set
  value: ${MAILER_API_KEY:-default-key}  # Optional, uses default if not set
```

**Important Notes:**

- **All environment variables are optional** - You only need to set the variables that you reference in your `config.yaml` or `template.yaml` files
- **Variable names are user-defined** - You can use any variable names you want in your config (e.g., `${MY_API_KEY}`, `${EMAIL_USER}`, etc.)
- **Only two environment variables have fixed names**: `CONFIG_PATH` and `TEMPLATES_DIR` (see [Environment Variables](#environment-variables) section)
- All other environment variable names are determined by what you write in your `config.yaml` or `template.yaml` files
- **Environment variable substitution works in both `config.yaml` and `template.yaml` files** - Use the same `${VAR_NAME}` syntax in both

### Account Types

#### SMTP

```yaml
accounts:
  smtp-account:
    type: smtp
    from: noreply@example.com # Optional: fallback 'from' address
    host: smtp.example.com
    port: 587
    secure: false # true for 465, false for other ports
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

**Note**: Folders starting with underscore (e.g., `_components`, `_utils`) are ignored by the template loader. This is useful for component-based renderers like React Email that may need shared components or utilities. These folders won't be treated as templates.

### Template Config (`template.yaml`)

```yaml
id: welcome
renderer: react-email
account: primary # Optional: default account for this template
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

- `id` (required): Unique template identifier (must match directory name)
- `renderer` (optional): Template renderer type (`react-email`, `mjml`, or `html`). Falls back to global default.
- `account` (optional): Default account to use for this template. Falls back to global default.
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
account: ${TEMPLATE_ACCOUNT:-primary}
from: ${TEMPLATE_FROM_EMAIL:-noreply@example.com}
schema:
  # ...
```

**Note**: All environment variables are optional. You only need to set the variables that you reference in your `template.yaml` files. Variable names are user-defined - use whatever names you prefer in your templates.

### React Email Template (`index.tsx`)

**Important**: React Email templates **must** explicitly import React, even though it may appear unused. This is required because the JSX transform doesn't work correctly with dynamic imports at runtime. The React import ensures templates can be dynamically loaded and rendered correctly.

```tsx
import React from 'react';
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

**API Key Authentication:**

```
x-mailer-api-key: <your-api-key>
```

**HMAC Request Signing:**

```
x-mailer-signature: t=<timestamp>,v1=<signature>
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
const signature = generateSignature(process.env.MAILER_SIGNING_SECRET, body);

fetch('https://mailer.example.com/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-mailer-signature': signature,
  },
  body: JSON.stringify(body),
});
```

**Postman Pre-Request Script:**

For testing with Postman, add this script to the "Pre-request Script" tab:

```javascript
const secret = pm.environment.get('MAILER_SIGNING_SECRET');
if (!secret) {
  throw new Error('MAILER_SIGNING_SECRET is required.');
}

// Get the request body as a string
const bodyString = pm.request.body.raw;
if (!bodyString) {
  console.error('Error: Request body is empty');
  throw new Error('Request body is required for HMAC signing');
}

// Generate Unix timestamp in seconds
const timestamp = Math.floor(Date.now() / 1000);
const message = `${timestamp}.${bodyString}`;

// Convert secret and message to ArrayBuffer
const encoder = new TextEncoder();
const keyData = encoder.encode(secret);
const messageData = encoder.encode(message);

// Import key and sign (async operation)
crypto.subtle
  .importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-512' } },
    false,
    ['sign'],
  )
  .then((key) => {
    return crypto.subtle.sign('HMAC', key, messageData);
  })
  .then((signatureBuffer) => {
    // Convert ArrayBuffer to hex string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Set the signature header
    const signatureHeader = `t=${timestamp},v1=${signature}`;
    pm.request.headers.add({
      key: 'x-mailer-signature',
      value: signatureHeader,
    });

    console.log('HMAC signature generated and added to request');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Signature: ${signature.substring(0, 16)}...`);
  })
  .catch((err) => {
    console.error('Error generating signature:', err);
    throw new Error(`Failed to generate HMAC signature: ${err.message}`);
  });
```

**Setup:**

1. Set an environment variable: `MAILER_SIGNING_SECRET = "your-secret-key"`
2. Paste the script into the "Pre-request Script" tab
3. Make sure your request body is set to "raw" with "JSON" format

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
- `account` (optional): Account to use. Falls back to `template.account` or `config.defaults.account`
- `payload` (required): Data to pass to the template (must match template schema)
- `sendMailOptions` (optional): Email sending options
  - `to` (required): Recipient email address(es) - string or array of strings
  - `from` (optional): Sender email address. Falls back to `template.from` > `account.from` if not provided
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

- **Account**: `request.account` > `template.account` > `config.defaults.account`
- **Renderer**: `template.renderer` > `config.defaults.renderer`
- **Email Options**: `request.sendMailOptions` > `template.from` > `account.from` (for `from` field only)

**Email Options Merge:**

1. The `from` field is resolved with the following priority: `request.sendMailOptions.from` (highest) > `template.from` > `account.from` (lowest)
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
  "details": ["Additional error details"] // Optional, for validation errors
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
  "details": ["userName: Required", "appName: Required"]
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
  "error": "Missing required field: 'from' in sendMailOptions. Provide it in request.sendMailOptions, template.from, or account.from (for 'from' field only)"
}
```

## Security Features

### Authentication

The service supports two authentication methods:

1. **API Key**: Simple string-based authentication (suitable for internal services)
2. **HMAC Request Signing**: Cryptographic signature-based authentication (recommended for public internet)

HMAC authentication provides:

- Request integrity verification
- Replay attack prevention (via timestamp tolerance)
- No token storage required

### IP Allowlisting (Optional)

IP allowlisting restricts access to specific IP addresses or CIDR blocks. This is useful for server-to-server communication where you know the source IPs.

**Configuration:**

```yaml
ipAllowlist:
  enabled: true
  allowedIps:
    - 192.168.1.0/24 # CIDR notation (all IPs in subnet)
    - 10.0.0.1 # Single IP address
```

**When to use:**

- Server-to-server communication with known backend IPs
- Additional layer of security beyond authentication
- Can reduce the need for aggressive rate limiting

### Rate Limiting (Optional)

Rate limiting prevents abuse by limiting the number of requests per time window. **Strongly recommended to use IP allowlisting alongside rate limiting** for server-to-server communication.

**Configuration:**

```yaml
rateLimit:
  enabled: true
  maxRequests: 100 # Maximum requests per window
  windowMinutes: 1 # Time window in minutes
  maxRequestsPerHour: 1000 # Maximum requests per hour
  windowHours: 1 # Hourly window
```

**How it works:**

- Tracks requests by IP address using a sliding window algorithm
- Applies both per-minute and per-hour limits (if configured)
- Returns `429 Too Many Requests` with `Retry-After` header when limit exceeded
- Fully user-configurable - set limits based on your usage patterns

**Recommendation:**

- For server-to-server communication, use IP allowlisting to restrict access, then add rate limiting to protect against bugs, compromised servers, or enforce quotas
- Rate limiting is optional and can be disabled entirely

### HTTPS Enforcement

HTTPS is enforced for all requests (except localhost for development). The service checks the `x-forwarded-proto` header from reverse proxies.

### Request Validation

- Body size limit: 1MB default (configurable via `requestValidation.maxBodySize`)
- Content-Type validation: Requires `application/json` for POST requests

**Configuration:**

```yaml
requestValidation:
  maxBodySize: 1048576 # Maximum request body size in bytes (default: 1048576 = 1MB)
```

The `maxBodySize` is specified in bytes. Common values:

- `1048576` = 1MB (default)
- `2097152` = 2MB
- `5242880` = 5MB

### Audit Logging

All requests are logged with:

- Timestamp
- IP address (when available - see IP Detection below)
- Endpoint and method
- Status code
- Response time
- Request size

**IP Address Detection:**

IP addresses are detected in the following scenarios:

- **Production with reverse proxy** (nginx, load balancer, etc.): IP from `x-forwarded-for` header ✅
- **Behind Cloudflare**: IP from `cf-connecting-ip` header ✅
- **Direct connection** (no proxy): Attempts to get IP from connection (may work) ⚠️
- **Localhost/testing** (Postman, curl from localhost): Returns `null` (no IP available) ❌

**Important for Production:**

- If using a reverse proxy, ensure it sets the `x-forwarded-for` header
- Most production setups (nginx, AWS ALB, etc.) set this header automatically
- Without a reverse proxy or proper headers, IP detection will fail
- This affects rate limiting and IP allowlisting (they require IP detection)

Special logging for:

- Failed authentication attempts
- Rate limit violations
- IP allowlist rejections
- Large requests (>100KB)
- Slow requests:
  - `/send` endpoint: >10 seconds (email sending via external SMTP typically takes 1-5 seconds)
  - Other endpoints: >1 second

**PII Handling:** Email addresses and payload content are not logged - only metadata (template ID, account ID, etc.) is recorded.

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

**All environment variables are optional**, and you can name them whatever you want based on your `config.yaml` file. The only exceptions are:

- `CONFIG_PATH` - Path to config file (default: `/config/config.yaml`)
- `TEMPLATES_DIR` - Path to templates directory (default: `/templates`)

**Note**: Most users using Docker will never need to set `CONFIG_PATH` or `TEMPLATES_DIR` because they can simply mount their config and template directories to the default paths (`/config` and `/templates`) in the Docker container. These environment variables are primarily useful for local development or custom Docker setups where you mount volumes to different paths.

**All other environment variables** are user-defined based on what you reference in your `config.yaml` using the `${VAR_NAME}` syntax. For example, if your config uses `${MY_CUSTOM_API_KEY}`, then you would set the `MY_CUSTOM_API_KEY` environment variable.

**Common examples** (these names are just examples - use whatever names you prefer):

- `${MAILER_API_KEY}` - API key for authentication (or `${API_KEY}`, `${AUTH_TOKEN}`, etc.)
- `${MAIL_FROM_EMAIL}` - Default sender email address (or `${FROM_EMAIL}`, `${SENDER}`, etc.)
- `${SMTP_USER}` - SMTP username (or `${EMAIL_USER}`, `${USERNAME}`, etc.)
- `${SMTP_PASSWORD}` - SMTP password (or `${EMAIL_PASS}`, `${PASSWORD}`, etc.)
- `PORT` - Server port (default: 3000) - Note: This is a special case used by the server, not referenced in config.yaml

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

**Note**: When mounting volumes to the default paths (`/config` and `/templates`) as shown above, you don't need to set the `CONFIG_PATH` or `TEMPLATES_DIR` environment variables. Only set these if you mount your volumes to different paths and need to override the defaults.
