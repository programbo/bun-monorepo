#!/usr/bin/env bun
import { lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '../../..')
const TARGET = path.join(ROOT_DIR, '.bun-create')
const SOURCE = path.resolve(import.meta.dir, '..', 'templates')

const ensureSymlink = async () => {
  await mkdir(SOURCE, { recursive: true })

  if (existsSync(TARGET)) {
    const stat = await lstat(TARGET)
    if (stat.isSymbolicLink()) {
      const current = await readlink(TARGET)
      if (path.resolve(path.dirname(TARGET), current) === SOURCE) return
    }

    await rm(TARGET, { recursive: true, force: true })
  }

  const rel = path.relative(path.dirname(TARGET), SOURCE)
  await symlink(rel, TARGET)
}

ensureSymlink().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
