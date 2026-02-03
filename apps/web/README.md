# web

React + Tailwind app powered by Bun.

## Setup

From repo root:

```bash
bun install
```

## Development

From repo root:

```bash
bun run --filter web dev
```

Or from this directory:

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

## Production

From repo root:

```bash
bun run --filter web build
bun run --filter web start
```

Or from this directory:

```bash
bun run build
bun start
```
