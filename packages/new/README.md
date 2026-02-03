# new

Workspace scaffolding scripts.

## Usage (from repo root)

```bash
bun run new web <name>
```

This creates `apps/<name>` using `bun init --react=tailwind`, replaces the default UI with a minimal container + welcome message, then runs `qa:init` to wire shared QA config.
