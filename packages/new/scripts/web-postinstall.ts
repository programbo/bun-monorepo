#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '../../..')
const TEMPLATE_SOURCE = path.resolve(ROOT_DIR, 'packages', 'new', 'templates', 'web', 'src', 'dev', 'serve-with-control.ts')

const USAGE = `
Usage:
  bun run web-postinstall --dir <path>
  bun run web-postinstall <path>
`.trim()

const parseArgs = () => {
  const args = process.argv.slice(2)
  let dir: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--dir') {
      dir = args[i + 1]
      i += 1
      continue
    }
    if (arg && !arg.startsWith('-') && !dir) {
      dir = arg
    }
  }

  if (!dir) {
    console.error('Missing --dir')
    console.log(USAGE)
    process.exit(1)
  }

  return path.resolve(ROOT_DIR, dir)
}

const updateIndex = async (targetDir: string) => {
  const indexPath = path.join(targetDir, 'src', 'index.ts')
  if (!existsSync(indexPath)) return

  const contents = await readFile(indexPath, 'utf8')
  if (contents.includes('serveWithControl')) return
  if (!contents.includes('serve({')) return

  const updated = contents
    .replace("import { serve } from 'bun'", "import { serveWithControl } from './dev/serve-with-control'")
    .replace('const server = serve({', 'const server = await serveWithControl({')

  await writeFile(indexPath, updated, 'utf8')
}

const ensureHelper = async (targetDir: string) => {
  const helperPath = path.join(targetDir, 'src', 'dev', 'serve-with-control.ts')
  if (existsSync(helperPath)) return
  await mkdir(path.dirname(helperPath), { recursive: true })
  const contents = await readFile(TEMPLATE_SOURCE, 'utf8')
  await writeFile(helperPath, contents, 'utf8')
}

const main = async () => {
  const dir = parseArgs()
  await ensureHelper(dir)
  await updateIndex(dir)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
