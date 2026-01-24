# @<monorepo-name>/config

Shared configuration package for Prettier, oxlint, and TypeScript. Works with both monorepos and standalone projects.

## Overview

This package provides centralized, opinionated configuration for code quality tools:

- **Prettier**: Code formatting with import sorting
- **oxlint**: Fast JavaScript/TypeScript linting
- **TypeScript**: Base configuration (copy `tsconfig.base.json` for your project)

## Installation

```bash
# npm
npm install -D @<monorepo-name>/config @trivago/prettier-plugin-sort-imports oxlint prettier prettier-plugin-tailwindcss typescript

# bun
bun install -D @<monorepo-name>/config @trivago/prettier-plugin-sort-imports oxlint prettier prettier-plugin-tailwindcss typescript

# yarn
yarn add -D @<monorepo-name>/config @trivago/prettier-plugin-sort-imports oxlint prettier prettier-plugin-tailwindcss typescript

# pnpm
pnpm add -D @<monorepo-name>/config @trivago/prettier-plugin-sort-imports oxlint prettier prettier-plugin-tailwindcss typescript
```

## Quick Start

### 1. Create Configuration Files

**Option A: With Tailwind CSS**

Create `.prettierrc.cjs`:

```javascript
module.exports = require('@<monorepo-name>/config/prettier/index-tailwind.js')
```

Create `oxlint.json`:

```json
{
  "extends": "@<monorepo-name>/config/oxlint/index.json"
}
```

Create `tsconfig.json`:

```json
{
  "extends": "@<monorepo-name>/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Option B: Without Tailwind CSS**

Create `.prettierrc.cjs`:

```javascript
module.exports = require('@<monorepo-name>/config/prettier/index.js')
```

Create `oxlint.json`:

```json
{
  "extends": "@<monorepo-name>/config/oxlint/index.json"
}
```

Create `tsconfig.json`:

```json
{
  "extends": "@<monorepo-name>/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2. Add Scripts to package.json

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "ci": "bun run lint && bun run typecheck"
  }
}
```

### 3. Run Commands

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Format code
bun run format

# Check formatting (CI)
bun run format:check

# Run all CI checks
bun run ci
```

---

## Monorepo Setup

For monorepos (Bun workspaces, npm workspaces, pnpm workspaces, Yarn workspaces):

### 1. Install at Monorepo Root

Add to root `package.json`:

```json
{
  "devDependencies": {
    "@<monorepo-name>/config": "workspace:*",
    "@trivago/prettier-plugin-sort-imports": "^6.0.2",
    "oxlint": "^1.38.0",
    "prettier": "^3.7.4",
    "prettier-plugin-tailwindcss": "^0.7.2",
    "typescript": "^5.9.3"
  }
}
```

### 2. Add Root-Level Scripts

```json
{
  "scripts": {
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "bun run --filter '*' lint",
    "format": "bun run --filter '*' format",
    "format:check": "bun run --filter '*' format:check",
    "ci": "bun run lint && bun run typecheck"
  }
}
```

### 3. Configure Each Workspace

Add scripts to each workspace `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@<monorepo-name>/config": "workspace:*"
  }
}
```

### 4. Workspace Config Files

**With Tailwind CSS** (`.prettierrc.cjs`):

```javascript
module.exports = require('@<monorepo-name>/config/prettier/index-tailwind.js')
```

**Without Tailwind CSS** (`.prettierrc.cjs`):

```javascript
module.exports = require('@<monorepo-name>/config/prettier/index.js')
```

**oxlint.json**:

```json
{
  "extends": "@<monorepo-name>/config/oxlint/index.json"
}
```

**tsconfig.json**:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Tailwind CSS Setup

### VS Code IntelliSense

If using the [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) extension, add to `.vscode/settings.json`:

```json
{
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cva\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

This enables class sorting in:

- `clsx()` - clsx library
- `cn()` - custom helper (clsx + twMerge)
- `cva()` - class variance authority
- `cnJoin()`, `twMerge()`, `twJoin()` - other utilities

### Tailwind Functions

The Tailwind Prettier config includes:

```javascript
tailwindFunctions: ['clsx', 'cva', 'cn', 'cnJoin', 'twMerge', 'twJoin']
```

To add more functions, extend the config:

```javascript
// .prettierrc.cjs
const baseConfig = require('@<monorepo-name>/config/prettier/index-tailwind.js')

module.exports = {
  ...baseConfig,
  tailwindFunctions: [...baseConfig.tailwindFunctions, 'myCustomFunction'],
}
```

---

## Configuration Details

### Prettier

**Base config** (`prettier/index.js`):

- Arrow parentheses: always
- Single quotes: true
- Trailing commas: all
- Print width: 100 (80 for JSON)
- Tab width: 2
- Semicolons: false
- Import sorting via `@trivago/prettier-plugin-sort-imports`
  - React imports first
  - Next.js imports second (if applicable)
  - Third-party modules
  - Workspace imports
  - Absolute imports (`@/*`)
  - Relative imports

**Tailwind config** (`prettier/index-tailwind.js`):

- Extends base config
- Adds Tailwind CSS class sorting plugin
- Includes tailwind functions for clsx/cva utilities

### oxlint

Config (`oxlint/index.json`):

- **Categories**: `correctness`, `suspicious`, `perf`, `style` set to "warn"
- **Restriction**: disabled
- **Ignored**: `node_modules`, `dist`, `build`, `.next`, `out`, `coverage`
- **Environment**: Node.js + ES2021

### TypeScript

Copy the base config from this package or reference it:

```json
{
  "extends": "@<monorepo-name>/config/tsconfig.base.json",
  "compilerOptions": {
    // Add your options
  }
}
```

**Base settings**:

- Target: ES2022
- Module: ESNext
- Module resolution: bundler
- Strict mode: enabled
- JSX: react-jsx
- Paths: none (add your own)

---

## Extending Configuration

### Override Prettier

```javascript
// .prettierrc.cjs
const baseConfig = require('@<monorepo-name>/config/prettier/index.js')

module.exports = {
  ...baseConfig,
  printWidth: 120,
  semi: true,
  // Add your options
}
```

### Override oxlint

```json
{
  "extends": "@<monorepo-name>/config/oxlint/index.json",
  "categories": {
    "correctness": "error"
  },
  "ignore": ["node_modules", "dist", "build", ".next", "out", "coverage", "custom-dir"]
}
```

### Override TypeScript

```json
{
  "extends": "@<monorepo-name>/config/tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Monorepo Usage Examples

### Run from Root

```bash
# Type check all packages
bun run typecheck

# Lint all packages
bun run lint

# Format all packages
bun run format

# Check formatting
bun run format:check

# Run CI pipeline
bun run ci
```

### Run for Specific Workspace

```bash
# Using Bun's filter syntax
bun run --filter '@your-scope/package-name' typecheck
bun run --filter '@your-scope/package-name' lint
```

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install dependencies
  run: bun install

- name: Run lint
  run: bun run lint

- name: Type check
  run: bun run typecheck

- name: Check formatting
  run: bun run format:check
```

Or combined:

```yaml
- name: Run CI checks
  run: bun run ci
```

---

## File Structure

```
@<monorepo-name>/config/
├── package.json
├── README.md
├── tsconfig.json
├── prettier/
│   ├── index.js          # Base Prettier config
│   └── index-tailwind.js # Prettier + Tailwind class sorting
└── oxlint/
    └── index.json        # oxlint configuration
```

**Note**: For TypeScript, copy the base config from this package or reference `@<monorepo-name>/config/tsconfig.base.json` (if published with your adjustments).

---

## Peer Dependencies

This package requires these peer dependencies to be installed in your project:

```json
{
  "devDependencies": {
    "@trivago/prettier-plugin-sort-imports": "^6.0.2",
    "oxlint": "^1.38.0",
    "prettier": "^3.7.4",
    "prettier-plugin-tailwindcss": "^0.7.2",
    "typescript": "^5.9.3"
  }
}
```

---

## License

MIT
