#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import path from 'node:path'

const PACKAGE_DIR = path.resolve(import.meta.dir, '..')
const REPO_ROOT = path.resolve(PACKAGE_DIR, '../..')
const QA_DIR = path.join(REPO_ROOT, 'packages', 'qa')

const run = async (command: string, args: string[], cwd: string) => {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

const main = async () => {
  if (!existsSync(QA_DIR)) return

  await run('bun', ['run', '--cwd', QA_DIR, 'qa:init', '--dir', PACKAGE_DIR, '--kind', 'cli'], REPO_ROOT)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
