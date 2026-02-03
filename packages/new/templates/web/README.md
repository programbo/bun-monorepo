# web

Bun React + Tailwind app.

## Dev

```bash
bun dev
```

## Ports

Default port is `3000`. If it is in use, the server increments by 1 until a free port is found.
You can also set `PORT` to force a starting port or `PORT_OFFSET` to start at `3000 + PORT_OFFSET`.

## Restart Signaling

The server listens on a local Unix socket at `.dev/web.sock` and accepts:

- `restart`: restart the server in-place
- `stop`: stop the server

Example:

```bash
printf restart | nc -U .dev/web.sock
```

## QA

```bash
bun run qa:init --dir . --kind web --tailwind
```
