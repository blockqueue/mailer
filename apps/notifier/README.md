# Notifier Service

This directory contains the notifier service application. For complete documentation, see the [main README](../../README.md).

## Quick Reference

- **Main entry point**: `src/index.ts`
- **Development**: `npm run dev`
- **Build**: `npm run build` (server + `compile-templates` CLI)
- **Compile templates**: `npm run compile-templates -- <inputDir> <outputDir>`
- **Start (production bundle)**: `npm start`
- **Lint**: `npm run lint`
- **Routes**: `POST /email/send`, `POST /sms/send`, `GET /health`

For shipping your own templates on top of the published image, see [examples/notifier-service](../../examples/notifier-service).
