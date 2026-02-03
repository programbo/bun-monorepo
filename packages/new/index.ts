#!/usr/bin/env bun
import { metadata as cliMeta, scaffoldCli } from './scaffolders/cli'
import { metadata as libMeta, scaffoldLib } from './scaffolders/lib'
import { metadata as uiMeta, scaffoldUi } from './scaffolders/ui'
import { resolveTarget, type AppType } from './scaffolders/utils'
import { metadata as webMeta, scaffoldWeb } from './scaffolders/web'

const USAGE = `
Usage:
  bun run new <type> <name>

Types:
  web   Creates a Bun React + Tailwind app in apps/<name>
  cli   Creates a CLI package in packages/<name>
  lib   Creates a library package in packages/<name>
  ui    Creates a Tailwind UI library in packages/<name> (via bun create)
`.trim()

const main = async () => {
  const [, , typeArg, nameArg] = process.argv
  if (!typeArg || !nameArg) {
    console.log(USAGE)
    process.exit(1)
  }

  if (!['web', 'cli', 'lib', 'ui'].includes(typeArg)) {
    throw new Error(`Unsupported type: ${typeArg}`)
  }

  const type = typeArg as AppType
  const metadata: Record<AppType, { defaultRoot: 'apps' | 'packages' }> = {
    web: webMeta,
    cli: cliMeta,
    lib: libMeta,
    ui: uiMeta,
  }

  const targetDir = resolveTarget(nameArg, metadata[type].defaultRoot)
  const handlers: Record<AppType, (dir: string) => Promise<void>> = {
    web: scaffoldWeb,
    cli: scaffoldCli,
    lib: scaffoldLib,
    ui: scaffoldUi,
  }

  await handlers[type](targetDir)

  console.log(`Created ${type} app at ${targetDir}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
