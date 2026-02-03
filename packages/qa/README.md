# @repo/qa

Shared QA configuration for this monorepo.

Includes:

- Prettier config (base + Tailwind)
- Oxlint config
- TypeScript base config

## Usage

Add the package to any app or package:

```bash
bun add -d @repo/qa
```

For TailwindCSS projects, use `@repo/qa/prettier-tailwind` instead of the base Prettier config.

### Web app integration (apps/web)

1. Add config files:

```js
// prettier.config.cjs
module.exports = require('@repo/qa/prettier-tailwind')
```

```json
// oxlint.json
{
  "$schema": "https://oxc.rs/schema/oxlint.json",
  "extends": ["@repo/qa/oxlint"]
}
```

```json
// tsconfig.json
{
  "extends": "@repo/qa/tsconfig",
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "jsx": "react-jsx"
  }
}
```

2. Add scripts:

```json
{
  "scripts": {
    "lint": "oxlint --config oxlint.json --fix .",
    "format": "prettier --config prettier.config.cjs --write .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

### CLI package integration (packages/cli)

1. Add config files:

```js
// prettier.config.cjs
module.exports = require('@repo/qa/prettier')
```

```json
// oxlint.json
{
  "$schema": "https://oxc.rs/schema/oxlint.json",
  "extends": ["@repo/qa/oxlint"]
}
```

```json
// tsconfig.json
{
  "extends": "@repo/qa/tsconfig",
  "compilerOptions": {
    "lib": ["ESNext"],
    "moduleResolution": "bundler"
  }
}
```

2. Add scripts (including bunup build):

```json
{
  "scripts": {
    "build": "bunup",
    "lint": "oxlint --config oxlint.json --fix .",
    "format": "prettier --config prettier.config.cjs --write .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

3. Add a `bunup.config.ts`:

```ts
import { defineConfig } from 'bunup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node',
  sourcemap: true,
})
```

### Library package integration (packages/lib)

1. Add config files (same as CLI):

```js
// prettier.config.cjs
module.exports = require('@repo/qa/prettier')
```

```json
// oxlint.json
{
  "$schema": "https://oxc.rs/schema/oxlint.json",
  "extends": ["@repo/qa/oxlint"]
}
```

```json
// tsconfig.json
{
  "extends": "@repo/qa/tsconfig"
}
```

2. Add scripts (including bunup build):

```json
{
  "scripts": {
    "build": "bunup",
    "lint": "oxlint --config oxlint.json --fix .",
    "format": "prettier --config prettier.config.cjs --write .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

3. Add a `bunup.config.ts`:

```ts
import { defineConfig } from 'bunup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  target: 'node',
  sourcemap: true,
  dts: true,
})
```
