# Compiles emails/ into the slim mailer image. Preview locally with `npm run dev`.
# Build: docker build --build-arg MAILER_IMAGE=blockqueue/mailer:latest .

ARG MAILER_IMAGE=ghcr.io/blockqueue/mailer:latest

FROM ${MAILER_IMAGE} AS mailer

FROM node:24-alpine AS compile
WORKDIR /work
COPY --from=mailer /app/dist/compile-templates.mjs ./compile-templates.mjs
RUN npm init -y \
  && npm install \
    esbuild@0.27.2 \
    mjml@4.18.0 \
    @react-email/components@0.5.7 \
    react@19.2.3 \
    react-dom@19.2.3
COPY ./emails /templates-src
RUN node ./compile-templates.mjs /templates-src /app/templates

FROM ${MAILER_IMAGE}
COPY --from=compile /app/templates /app/templates
COPY ./config/config.yaml /config/config.yaml
