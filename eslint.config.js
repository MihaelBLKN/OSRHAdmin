import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js"],
        },
        tsconfigRootDir: dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
    },
  },
]);
