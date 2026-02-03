# bun-monorepo-template

This repository is a Bun workspaces monorepo. The existing React + Tailwind app lives in `apps/web`.
Shared QA config lives in `packages/qa`.

## Setup

Install all workspace dependencies from the repo root:

```bash
bun install
```

## Development

Run the web app dev server:

```bash
bun run --filter web dev
```

Or from the app directory:

```bash
cd apps/web
bun dev
```

## Quality Assurance

All apps and packages use the shared QA package. Each workspace should include scripts to run:

- `bun lint --fix`
- `bun format --write`
- `bun typecheck --project tsconfig.json`

Integration details and templates live in `packages/qa/README.md`.

## Production

Build and run the web app:

```bash
bun run --filter web build
bun run --filter web start
```

Or from the app directory:

```bash
cd apps/web
bun run build
bun start
```
