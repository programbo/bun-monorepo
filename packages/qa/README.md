# @repo/qa

Shared QA config for the monorepo (Prettier, Oxlint, TypeScript).

## TL;DR

```bash
bun run qa:init --dir apps/web --kind web --tailwind
bun run qa:init --dir packages/cli --kind cli
bun run qa:init --dir packages/lib --kind lib
 bun run qa:init apps/web --kind web --tailwind
```

## What It Does

`qa:init` wires:

- `prettier.config.cjs`
- `oxlint.json`
- `tsconfig.json` (preset based on project type)
- `lint`, `format`, `typecheck` scripts

## Options

- `--dir <path>` (optional; or pass the path as the first argument)
- `--kind web|cli|lib|auto` (default: `auto`)
- `--tailwind` (forces Tailwind Prettier config)
- `--force` (overwrite existing config files)

## Presets

Exported presets:

- `@repo/qa/tsconfig` (base)
- `@repo/qa/tsconfig/node`
- `@repo/qa/tsconfig/web`
- `@repo/qa/tsconfig/react-lib`

`qa:init` uses:

- `web` → `@repo/qa/tsconfig/web`
- `cli`/`lib` → `@repo/qa/tsconfig/node`
- React library packages → `@repo/qa/tsconfig/react-lib`

## Heuristics (when `--kind auto`)

- `web` if `react`, `react-dom`, `next`, or `vite` is present
- `cli` if `bin` is present or name contains `cli`
- otherwise `lib`
- Tailwind is enabled automatically if `tailwindcss` is present

## Manual Setup (Rare)

If you need to wire configs by hand, see the templates used by `qa:init` in `packages/qa`.
