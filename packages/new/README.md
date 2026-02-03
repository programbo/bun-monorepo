# new

Scaffold apps and packages with consistent defaults.

## TL;DR

```bash
bun run new web my-app
bun run new cli my-cli
bun run new lib my-lib
bun run new ui packages/neon-ui-2026
```

## What It Does

- `web`: `apps/<name>` via `bun init --react=tailwind`, then replaces the UI and runs `qa:init`.
- `cli`: `packages/<name>` from local templates, then runs `qa:init`.
- `lib`: `packages/<name>` from local templates, then runs `qa:init`.
- `ui`: `packages/<name>` from local templates, then runs `qa:init` with Tailwind.

## Notes

- You can pass a full path like `packages/foo` to control the destination.
- Templates live in `packages/new/templates` and are exposed via the `.bun-create` symlink.
- Set `BUN_NEW_WEB_TEMPLATE=1` to scaffold web apps from the local template (useful for tests/offline work).
