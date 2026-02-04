#!/usr/bin/env bun
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '..')

const updateIndex = async () => {
  const indexPath = path.join(ROOT_DIR, 'src', 'index.ts')
  if (!existsSync(indexPath)) return

  const contents = await readFile(indexPath, 'utf8')
  if (contents.includes('serveWithControl')) return
  if (!contents.includes('serve({')) return

  const updated = contents
    .replace("import { serve } from 'bun'", "import { serveWithControl } from './dev/serve-with-control'")
    .replace('const server = serve({', 'const server = await serveWithControl({')

  await writeFile(indexPath, updated, 'utf8')
}

const main = async () => {
  await updateIndex()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
