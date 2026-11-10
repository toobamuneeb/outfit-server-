// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Leftover Expo Router template files (not imported by App.tsx) — safe to delete.
    ignores: ["dist/*", "scripts/*", "src/app/*", "src/hooks/*", "src/constants/*", "src/components/ui/*", "src/components/*.ts", "src/components/*.tsx"],
  }
]);
