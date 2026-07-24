# Example Mail Service

Canonical example of shipping your own templates on top of the BlockQueue mailer image — the same pattern used in production at BlockQueue.

## Workflow

1. **Edit** source templates under `emails/` (`.tsx`, `.mjml`, or `.html`)
2. **Preview** with React Email (`npm run dev`)
3. **Build** the final image when ready — the Dockerfile compiles templates, then copies artifacts into the slim mailer runtime

You never need to precompile templates locally for day-to-day editing.

## Project structure

```
examples/mail-service/
├── emails/                 # Source templates (editable)
│   ├── _components/        # Shared React Email components
│   ├── _utility/           # Shared utilities
│   ├── welcome-react-email/
│   ├── welcome-mjml-email/
│   └── welcome-html-email/
├── config/
│   └── config.yaml         # Auth, accounts, defaults
├── scripts/                # Optional API smoke tests
├── Dockerfile              # Compile stage + slim runtime
├── package.json            # Preview-only dependencies
└── Readme.md
```

## Development (preview)

```bash
cd examples/mail-service
npm install
npm run dev
```

Open [http://localhost:10001](http://localhost:10001).

## Build the production image

The mailer runtime image must exist locally or be pullable. To use a locally built mailer:

```bash
# From the repo root — build the slim mailer runtime
docker build -t blockqueue/mailer:latest -f docker/mailer/Dockerfile.prod .

# From this directory — compile templates and bake them into a consumer image
docker build -t example-mail-service \
  --build-arg MAILER_IMAGE=blockqueue/mailer:latest .
```

What the Dockerfile does:

1. **Compile stage** (`node:24-alpine`): installs `esbuild`, `mjml`, and `@react-email/components`, then runs `compile-templates.mjs` from the mailer image (copied into the workdir so ESM can resolve those packages)
   - React Email → `index.mjs` (components inlined; `react` / `@react-email/render` left external)
   - MJML → `index.html` with `{{vars}}` preserved (`renderer` rewritten to `html`)
   - HTML → copied as-is
2. **Runtime stage** (slim mailer): copies compiled `/templates` + `config.yaml` only

Compile tooling never ends up in the final image.

## Run

```bash
docker run --rm -p 3000:3000 \
  -e MAILER_SIGNING_SECRET=dev-secret \
  -e MAIL_FROM_EMAIL=noreply@example.com \
  -e ZEPTOMAIL_API_KEY= \
  -e AWS_REGION=eu-west-2 \
  -e AWS_ACCESS_KEY_ID= \
  -e AWS_SECRET_ACCESS_KEY= \
  example-mail-service
```

Adjust env vars to match `config/config.yaml`.

## Adapting this for your service

Copy this folder as a starting point:

1. Replace `emails/` with your templates
2. Update `config/config.yaml`
3. Point `MAILER_IMAGE` at a published tag, e.g. `ghcr.io/blockqueue/mailer:vX`
4. Build and deploy — template changes require a new image build (same as baking `COPY ./emails` without compile)
