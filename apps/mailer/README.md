# Mailer Service

This directory contains the mailer service application. For complete documentation, see the [main README](../../README.md).

## Quick Reference

- **Main entry point**: `src/index.ts`
- **Development**: `npm run dev`
- **Build**: `npm run build` (server + `compile-templates` CLI)
- **Compile templates**: `npm run compile-templates -- <inputDir> <outputDir>`
- **Start (production bundle)**: `npm start`
- **Lint**: `npm run lint`

For shipping your own templates on top of the published image, see [examples/mail-service](../../examples/mail-service).

For setup, configuration, API documentation, and usage instructions, please refer to the [main README](../../README.md).
