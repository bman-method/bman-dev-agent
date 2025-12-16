module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: ["dist/", "node_modules/", ".bman/"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    curly: ["error", "all"],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        args: "all",
        argsIgnorePattern: "^$",
        varsIgnorePattern: "^$",
        caughtErrorsIgnorePattern: "^$",
      },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: false }],
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "function", next: "function" },
    ],
  },
};
