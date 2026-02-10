# new

Scaffold apps and packages with consistent defaults.

## TL;DR

```bash
bun new web my-app
bun new api my-api
bun new cli my-cli
bun new lib my-lib
bun new ui packages/neon-ui-2026
```

## What It Does

- `web`: `apps/<name>` via `bun init --react=tailwind`, then replaces the UI and runs `qa:init`.
- `api`: `apps/<name>` from local templates, then runs `qa:init`.
- `cli`: `packages/<name>` from local templates, then runs `qa:init`.
- `lib`: `packages/<name>` from local templates, then runs `qa:init`.
- `ui`: `packages/<name>` from local templates, then runs `qa:init` with Tailwind.
- All templates run `bun install` at the repo root when they finish scaffolding.
- Pass `--no-install` to skip the install.
- If you omit `<name>`, the template name is used (ex: `cli` -> `packages/cli`).

## Notes

- You can pass a full path like `packages/foo` to control the destination.
- Templates live in `packages/_new/templates` and are exposed via the `.bun-create` symlink.
- `.bun-create` is created via postinstall and should not be committed.
- Set `BUN_NEW_WEB_TEMPLATE=1` to scaffold web apps from the local template (useful for tests/offline work).
