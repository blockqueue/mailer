// @ts-expect-error - @hono/eslint-config exports a valid ESLint config array
import baseConfig from "@hono/eslint-config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('eslint').Linter.Config[]} */
const baseConfigArray = Array.isArray(baseConfig) ? baseConfig : [baseConfig];

export default [
  ...baseConfigArray,
  {
    ignores: ["**/*.mjs"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: path.resolve(__dirname, "tsconfig.json"),
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    rules: {
      // Disable import ordering since we use prettier organize import
      "import-x/order": "off",
    },
  },
];
