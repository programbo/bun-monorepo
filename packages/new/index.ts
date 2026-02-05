#!/usr/bin/env bun
import { metadata as cliMeta, scaffoldCli } from './scaffolders/cli'
import { metadata as libMeta, scaffoldLib } from './scaffolders/lib'
import { metadata as uiMeta, scaffoldUi } from './scaffolders/ui'
import { resolveTarget, type AppType } from './scaffolders/utils'
import { metadata as webMeta, scaffoldWeb } from './scaffolders/web'

const USAGE = `
Usage:
  bun run new <type> [name] [--no-install]

Types:
  web   Creates a Bun React + Tailwind app in apps/<name>
  cli   Creates a CLI package in packages/<name>
  lib   Creates a library package in packages/<name>
  ui    Creates a Tailwind UI library in packages/<name> (via bun create)
`.trim()

const main = async () => {
  const args = process.argv.slice(2)
  const [typeArg, ...rest] = args
  if (!typeArg) {
    console.log(USAGE)
    process.exit(1)
  }

  if (!['web', 'cli', 'lib', 'ui'].includes(typeArg)) {
    throw new Error(`Unsupported type: ${typeArg}`)
  }

  const type = typeArg as AppType
  const nameArg = rest.find((arg) => !arg.startsWith('-')) ?? type
  const metadata: Record<AppType, { defaultRoot: 'apps' | 'packages' }> = {
    web: webMeta,
    cli: cliMeta,
    lib: libMeta,
    ui: uiMeta,
  }

  const targetDir = resolveTarget(nameArg, metadata[type].defaultRoot)
  const install = !rest.includes('--no-install')
  const options = { install }
  const handlers: Record<AppType, (dir: string, options: { install: boolean }) => Promise<void>> = {
    web: scaffoldWeb,
    cli: scaffoldCli,
    lib: scaffoldLib,
    ui: scaffoldUi,
  }

  await handlers[type](targetDir, options)

  console.log(`Created ${type} app at ${targetDir}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
