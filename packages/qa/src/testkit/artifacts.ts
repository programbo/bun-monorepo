import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const safeSegment = (input: string) => input.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')

const hasWorkspaceConfig = (dir: string) => {
  const pkgPath = path.join(dir, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const raw = readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw) as { workspaces?: unknown }
    return Boolean(pkg.workspaces)
  } catch {
    return false
  }
}

const isRepoRoot = (dir: string) => existsSync(path.join(dir, 'bun.lock')) || hasWorkspaceConfig(dir)

export const findRepoRoot = (start = process.cwd()) => {
  let current = path.resolve(start)
  while (true) {
    if (isRepoRoot(current)) return current
    const parent = path.dirname(current)
    if (parent === current) return start
    current = parent
  }
}

export const resolveOutputRoot = (start = process.cwd()) => path.join(findRepoRoot(start), 'output')

export const artifactDir = (type: string, start = process.cwd()) => {
  const dir = path.join(resolveOutputRoot(start), safeSegment(type))
  mkdirSync(dir, { recursive: true })
  return dir
}

export const artifactPath = (type: string, filename: string, start = process.cwd()) =>
  path.join(artifactDir(type, start), safeSegment(filename))

export const writeArtifact = async (
  type: string,
  filename: string,
  contents: string | ArrayBuffer | ArrayBufferView,
  start = process.cwd(),
) => {
  const filePath = artifactPath(type, filename, start)
  await Bun.write(filePath, contents)
  return filePath
}

export const writeJsonArtifact = async (
  type: string,
  filename: string,
  data: unknown,
  start = process.cwd(),
) => {
  const payload = `${JSON.stringify(data, undefined, 2)}\n`
  return await writeArtifact(type, filename, payload, start)
}
