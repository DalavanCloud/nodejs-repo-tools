---
extends:
  - 'eslint:recommended'
  - 'plugin:node/recommended'
  - prettier
plugins:
  - node
  - prettier
rules:
  prettier/prettier: error
  block-scoped-var: error
  eqeqeq: error
  no-warning-comments: warn
  no-var: error
  prefer-const: error
