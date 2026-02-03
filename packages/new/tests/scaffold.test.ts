import { mkdir, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const PACKAGES_DIR = path.resolve(import.meta.dir, '../..')
const ROOT_DIR = path.resolve(PACKAGES_DIR, '..')

const readJson = async (filePath: string) => JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>

const run = async (args: string[], cwd: string, env?: Record<string, string | undefined>) => {
  const proc = Bun.spawn(['bun', ...args], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text()
    throw new Error(err || `bun ${args.join(' ')} failed with code ${exitCode}`)
  }
}

const ensureExists = (filePath: string) => {
  expect(existsSync(filePath)).toBeTrue()
}

const ensureExtends = (value: unknown, expected: string) => {
  if (Array.isArray(value)) {
    expect(value.includes(expected)).toBeTrue()
    return
  }
  if (typeof value === 'string') {
    expect(value).toBe(expected)
    return
  }
  throw new Error(`Expected extends to include ${expected}`)
}

describe('new scaffolds', () => {
  const runId = randomUUID()
  const tmpRoot = path.join(ROOT_DIR, '.tmp', `new-scaffolds-${runId}`)
  const bunTmpDir = path.join(tmpRoot, 'bun-tmp')

  const webDir = path.join(tmpRoot, 'apps', 'web-fixture')
  const cliDir = path.join(tmpRoot, 'packages', 'cli-fixture')
  const libDir = path.join(tmpRoot, 'packages', 'lib-fixture')
  const uiDir = path.join(tmpRoot, 'packages', 'ui-fixture')

  beforeAll(async () => {
    await mkdir(bunTmpDir, { recursive: true })
    const env = {
      BUN_TMPDIR: bunTmpDir,
      TMPDIR: bunTmpDir,
      TEMP: bunTmpDir,
      TMP: bunTmpDir,
      BUN_NEW_WEB_TEMPLATE: '1',
    }
    await run(['run', 'new', 'web', path.relative(ROOT_DIR, webDir)], ROOT_DIR, env)
    await run(['run', 'new', 'cli', path.relative(ROOT_DIR, cliDir)], ROOT_DIR, env)
    await run(['run', 'new', 'lib', path.relative(ROOT_DIR, libDir)], ROOT_DIR, env)
    await run(['run', 'new', 'ui', path.relative(ROOT_DIR, uiDir)], ROOT_DIR, env)
  })

  afterAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('scaffolds a web app with QA config', async () => {
    ensureExists(path.join(webDir, 'package.json'))
    ensureExists(path.join(webDir, 'bunfig.toml'))
    ensureExists(path.join(webDir, 'build.ts'))
    ensureExists(path.join(webDir, 'bun-env.d.ts'))
    ensureExists(path.join(webDir, 'src', 'App.tsx'))
    ensureExists(path.join(webDir, 'src', 'index.ts'))
    ensureExists(path.join(webDir, 'src', 'index.html'))
    ensureExists(path.join(webDir, 'src', 'index.css'))

    ensureExists(path.join(webDir, 'prettier.config.cjs'))
    ensureExists(path.join(webDir, 'oxlint.json'))
    ensureExists(path.join(webDir, 'tsconfig.json'))

    const pkg = await readJson(path.join(webDir, 'package.json'))
    const scripts = (pkg.scripts ?? {}) as Record<string, string>
    const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>

    expect(scripts.lint).toBeDefined()
    expect(scripts.format).toBeDefined()
    expect(scripts.typecheck).toBeDefined()
    expect(devDependencies['@repo/qa']).toBeDefined()

    const prettierConfig = await readFile(path.join(webDir, 'prettier.config.cjs'), 'utf8')
    expect(prettierConfig).toContain('@repo/qa/prettier-tailwind')

    const oxlint = await readJson(path.join(webDir, 'oxlint.json'))
    ensureExtends(oxlint.extends, '@repo/qa/oxlint')

    const tsconfig = await readJson(path.join(webDir, 'tsconfig.json'))
    expect(tsconfig.extends).toBe('@repo/qa/tsconfig/web')
  })

  it('scaffolds cli/lib/ui packages with QA config', async () => {
    const packages = [
      { dir: cliDir, kind: 'cli', tsconfig: '@repo/qa/tsconfig/node', tailwind: false },
      { dir: libDir, kind: 'lib', tsconfig: '@repo/qa/tsconfig/node', tailwind: false },
      { dir: uiDir, kind: 'ui', tsconfig: '@repo/qa/tsconfig/react-lib', tailwind: true },
    ]

    for (const pkgInfo of packages) {
      const { dir, tsconfig: tsconfigPreset, tailwind } = pkgInfo
      ensureExists(path.join(dir, 'package.json'))
      ensureExists(path.join(dir, 'src', 'index.ts'))
      ensureExists(path.join(dir, 'bunup.config.ts'))
      ensureExists(path.join(dir, 'prettier.config.cjs'))
      ensureExists(path.join(dir, 'oxlint.json'))
      ensureExists(path.join(dir, 'tsconfig.json'))

      const pkg = await readJson(path.join(dir, 'package.json'))
      const scripts = (pkg.scripts ?? {}) as Record<string, string>
      const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>

      expect(scripts.lint).toBeDefined()
      expect(scripts.format).toBeDefined()
      expect(scripts.typecheck).toBeDefined()
      expect(scripts.build).toBeDefined()
      expect(devDependencies['@repo/qa']).toBeDefined()

      const prettierConfig = await readFile(path.join(dir, 'prettier.config.cjs'), 'utf8')
      const expectedPrettier = tailwind ? '@repo/qa/prettier-tailwind' : '@repo/qa/prettier'
      expect(prettierConfig).toContain(expectedPrettier)

      const oxlint = await readJson(path.join(dir, 'oxlint.json'))
      ensureExtends(oxlint.extends, '@repo/qa/oxlint')

      const tsconfig = await readJson(path.join(dir, 'tsconfig.json'))
      expect(tsconfig.extends).toBe(tsconfigPreset)
    }
  })
})
