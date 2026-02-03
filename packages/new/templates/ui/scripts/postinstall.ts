#!/usr/bin/env bun
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '../../..')
const APPS_DIR = path.join(ROOT_DIR, 'apps')
const UI_DEP = '@repo/ui'

const readJson = async <T>(filePath: string): Promise<T> => {
  const contents = await readFile(filePath, 'utf8')
  return JSON.parse(contents) as T
}

const writeJson = async (filePath: string, data: unknown) => {
  const contents = `${JSON.stringify(data, null, 2)}\n`
  await writeFile(filePath, contents, 'utf8')
}

const hasTailwind = (pkg: Record<string, unknown>) => {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
  return Boolean(deps.tailwindcss || devDeps.tailwindcss)
}

const hasUi = (pkg: Record<string, unknown>) => {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
  return Boolean(deps[UI_DEP] || devDeps[UI_DEP])
}

const promptYesNo = async (message: string) => {
  if (!process.stdin.isTTY) return false
  process.stdin.resume()
  process.stdout.write(`${message} [y/N] `)

  const data = await new Promise<string>((resolve) => {
    const onData = (chunk: Buffer) => {
      process.stdin.off('data', onData)
      resolve(chunk.toString('utf8').trim())
    }
    process.stdin.on('data', onData)
  })

  return data.toLowerCase() === 'y' || data.toLowerCase() === 'yes'
}

const findCssImportTarget = async (appDir: string) => {
  const candidates = [
    path.join(appDir, 'src', 'App.tsx'),
    path.join(appDir, 'src', 'App.jsx'),
    path.join(appDir, 'src', 'frontend.tsx'),
    path.join(appDir, 'src', 'main.tsx'),
    path.join(appDir, 'src', 'index.tsx'),
  ]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const contents = await readFile(filePath, 'utf8')
    if (contents.includes('index.css')) {
      return filePath
    }
  }

  return candidates.find((filePath) => existsSync(filePath)) ?? null
}

const addCssImport = async (filePath: string) => {
  const contents = await readFile(filePath, 'utf8')
  if (contents.includes('@repo/ui/index.css')) return

  const lines = contents.split('\n')
  const importIndex = lines.findIndex((line) => line.startsWith('import '))
  const insertIndex = importIndex >= 0 ? importIndex + 1 : 0
  lines.splice(insertIndex, 0, "import '@repo/ui/index.css'")

  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')
}

const main = async () => {
  if (!existsSync(APPS_DIR)) return

  const entries = await readdir(APPS_DIR)

  for (const appName of entries) {
    const appDir = path.join(APPS_DIR, appName)
    const packageJsonPath = path.join(appDir, 'package.json')
    if (!existsSync(packageJsonPath)) continue

    const pkg = await readJson<Record<string, unknown>>(packageJsonPath)
    if (!hasTailwind(pkg) || hasUi(pkg)) continue

    const allow = await promptYesNo(`Add ${UI_DEP} dependency to ${appName}?`)
    if (!allow) continue

    const deps = (pkg.dependencies ?? {}) as Record<string, string>
    deps[UI_DEP] = 'workspace:*'
    pkg.dependencies = deps

    await writeJson(packageJsonPath, pkg)

    const cssTarget = await findCssImportTarget(appDir)
    if (cssTarget) {
      const addCss = await promptYesNo(`Add UI CSS import to ${path.relative(ROOT_DIR, cssTarget)}?`)
      if (addCss) {
        await addCssImport(cssTarget)
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
