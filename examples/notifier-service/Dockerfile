ARG NOTIFIER_IMAGE=ghcr.io/blockqueue/notifier:latest

FROM ${NOTIFIER_IMAGE} AS notifier

FROM node:24-alpine AS compile
WORKDIR /work
COPY --from=notifier /app/dist/compile-templates.mjs ./compile-templates.mjs
RUN npm init -y \
  && npm install \
    esbuild@0.27.2 \
    mjml@4.18.0 \
    @react-email/components@0.5.7 \
    react@19.2.3 \
    react-dom@19.2.3
COPY ./templates /templates-src
RUN node ./compile-templates.mjs /templates-src /app/templates

FROM ${NOTIFIER_IMAGE}
COPY --from=compile /app/templates /app/templates
COPY ./config/config.yaml /config/config.yaml
