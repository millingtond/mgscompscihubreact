module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    "quotes": ["error", "double"],
    "indent": "off",
    "object-curly-spacing": "off",
    "max-len": "off",
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
  },
};