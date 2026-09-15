import js from "@eslint/js";
import globals from "globals";

// Deliberately a bug-finder, not a formatter.
//
// The codebase is already consistent by hand, so a style ruleset would
// mostly produce churn and a large diff nobody asked for. What is worth
// automating is the class of mistake that reads fine and fails at
// runtime: a typo'd identifier, a variable used before its declaration,
// an unreachable branch, a promise executor that swallows a return. Those
// are exactly what eslint:recommended covers.
//
// CI already runs `node --check` over public/assets/js, which catches a
// syntax error but nothing semantic — this is the layer above that.
export default [
  { ignores: ["dist/**", "node_modules/**", "public/assets/vendor/**"] },

  // Bundled source: ES modules, browser environment.
  {
    files: ["src/**/*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      ...js.configs.recommended.rules,
      // Signals an unfinished edit far more often than a deliberate one.
      "no-unused-vars": ["warn", {
        args: "after-used",
        argsIgnorePattern: "^_",
        // `catch (_)` is the house convention for a deliberately ignored
        // error; argsIgnorePattern does not cover caught bindings.
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  },

  // Standalone scripts: classic <script> files, not modules. They ship
  // straight from public/ and are the ones with no build-time checking
  // at all beyond `node --check`.
  {
    files: ["public/assets/js/**/*.js", "visual-lab/**/*.js", "websites/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: { ...globals.browser, gtag: "writable", dataLayer: "writable" }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", {
        args: "after-used",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      // These files intentionally guard against older engines.
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },

  // Tests run on Node.
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: js.configs.recommended.rules
  }
];
