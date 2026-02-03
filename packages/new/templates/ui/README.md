# ui

Tailwind CSS UI library template.

## Usage

```ts
import '@repo/ui/index.css'
import { Radio, RadioGroup, type RadioProps } from '@repo/ui/radio'
import { tv, twMerge, twJoin, type VariantProps } from '@repo/ui/utils'
```

## Dev

```bash
bun run dev
```

## Build

```bash
bun run build
```

After creation, run:

```bash
bun run qa:init --dir . --kind lib --tailwind
```
