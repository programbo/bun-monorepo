#!/usr/bin/env bun
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const PACKAGE_DIR = path.resolve(import.meta.dir, '..')

const readJson = async <TData>(filePath: string): Promise<TData> => {
  const contents = await readFile(filePath, 'utf8')
  return JSON.parse(contents) as TData
}

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

const findWorkspaceRoot = async (startDir: string) => {
  let current = startDir
  while (true) {
    const pkgPath = path.join(current, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = await readJson<{ workspaces?: unknown }>(pkgPath)
        if (pkg.workspaces) return current
      } catch {
        // ignore and keep walking
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const ensureQaPackage = async (workspaceRoot: string) => {
  const qaDir = path.join(workspaceRoot, 'packages', 'qa')
  if (existsSync(qaDir)) return qaDir

  const qaTemplateDir = path.join(workspaceRoot, '.bun-create', 'qa')
  if (!existsSync(qaTemplateDir)) return null

  await run('bun', ['create', 'qa', 'packages/qa', '--no-install', '--no-git'], workspaceRoot)
  return existsSync(qaDir) ? qaDir : null
}

const main = async () => {
  const workspaceRoot = await findWorkspaceRoot(PACKAGE_DIR)
  if (!workspaceRoot) return

  const qaDir = await ensureQaPackage(workspaceRoot)
  if (!qaDir) return

  await run('bun', ['run', '--cwd', qaDir, 'qa:init', '--dir', PACKAGE_DIR, '--kind', 'lib'], workspaceRoot)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
