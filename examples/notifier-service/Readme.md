# Example Notifier Service

Canonical example of shipping your own templates on top of the BlockQueue notifier image.

## Workflow

1. **Edit** source templates under `templates/` (`.tsx`, `.mjml`, or `.html`) — nested folders are fine; each `template.yaml` must have a unique `id`
2. **Preview** with `npm run dev` — React Email on :10001 and HTML/MJML on :10002 (or run either alone via `preview:react-email` / `preview:mjml-html`)
3. **Build** a consumer image — Dockerfile packages templates into `/app/templates` (React Email → `index.mjs`; MJML/HTML copied for runtime Handlebars + MJML)

Production always bakes templates into the image; volume mounts are not supported.

## Project structure

```
examples/notifier-service/
├── templates/                   # Source templates (nested OK; unique ids)
│   ├── project-a/
│   │   ├── html-user-welcome/
│   │   ├── html-order-receipt/  # Handlebars #each / #if
│   │   ├── mjml-user-welcome/
│   │   └── mjml-order-receipt/  # Handlebars #each / #if
│   └── project-b/
│       ├── mjml-login-otp/
│       ├── react-email-user-welcome/
│       └── react-email-order-receipt/  # map + conditional JSX
├── config/
│   └── config.yaml              # auth + email + sms channels
├── scripts/
├── Dockerfile
├── package.json
└── Readme.md
```

## Development (preview)

```bash
cd examples/notifier-service
npm install
npm run dev
```

Starts both preview servers:

- React Email (`.tsx`) — http://localhost:10001
- HTML / MJML (Handlebars) — http://localhost:10002

Run one side only with `npm run preview:react-email` or `npm run preview:mjml-html`.

Sample payloads for the static preview live in [`scripts/preview-payloads.json`](scripts/preview-payloads.json). Template edits reload the browser automatically.

For local API + source templates, use `apps/notifier` with `npm run dev` and `.env` from `.env.example`.

## Build

```bash
# From repo root
docker build -t blockqueue/notifier:latest -f docker/notifier/Dockerfile.prod .

# From this directory
docker build -t example-notifier-service \
  --build-arg NOTIFIER_IMAGE=blockqueue/notifier:latest .
```

## Run

```bash
docker run --rm -p 3000:3000 \
  -e NOTIFIER_SIGNING_SECRET=dev-secret \
  -e MAIL_FROM_EMAIL=noreply@example.com \
  -e ZEPTOMAIL_API_KEY=dummy-zeptomail-api-key \
  -e AWS_REGION=eu-west-2 \
  -e AWS_ACCESS_KEY_ID=dummy-aws-access-key-id \
  -e AWS_SECRET_ACCESS_KEY=dummy-aws-secret-access-key \
  -e TERMII_API_KEY=dummy-termii-api-key \
  -e TERMII_FROM=MyApp \
  example-notifier-service
```

Use real provider credentials to actually send mail/SMS. Empty env values fail config substitution when those accounts are referenced in `config.yaml`.

## API smoke

```bash
# Email — optional --sample=1..7 (default: 1 = mjml-user-welcome)
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js --sample=2   # html-user-welcome
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js --sample=3   # mjml-login-otp
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js --sample=4   # react-email-user-welcome
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js --sample=5   # mjml-order-receipt (line items)
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js --sample=6   # html-order-receipt (line items)
NOTIFIER_SIGNING_SECRET=… node scripts/send-welcome-mjml.js --sample=7   # react-email-order-receipt (line items)

# SMS (Termii)
NOTIFIER_SIGNING_SECRET=… node scripts/send-sms.js
```

`POST /email/send` uses templates. `POST /sms/send` uses account settings only; pass `sendOptions.version` as `v3` or `v4` to select the Termii host.
