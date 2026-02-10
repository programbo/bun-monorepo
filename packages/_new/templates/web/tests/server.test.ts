import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const ROOT_DIR = path.resolve(import.meta.dir, '..')

const readJson = async <T>(filePath: string) => {
  const contents = await Bun.file(filePath).text()
  return JSON.parse(contents) as T
}

const resolveQaPackageName = async () => {
  const pkg = await readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
    path.join(ROOT_DIR, 'package.json'),
  )
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  return Object.keys(deps).find((name) => name.endsWith('/qa')) ?? '@bun-monorepo-template/qa'
}

const qaPackageName = await resolveQaPackageName()
const testkit = await import(`${qaPackageName}/testkit`)

const { fetchJson, fetchText, expectStatus, startServer, waitForOutput, writeArtifact, writeJsonArtifact } =
  testkit as any

describe('web server', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  const TIMEOUT_MS = 15000

  beforeAll(async () => {
    server = await startServer({
      command: 'bun',
      args: ['src/index.ts'],
      cwd: ROOT_DIR,
      readyPath: '/api/hello',
      readyTimeoutMs: 6000,
    })
    await server.ready
  }, TIMEOUT_MS)

  afterAll(async () => {
    await server.stop()
  }, TIMEOUT_MS)

  it('serves the index HTML', async () => {
    const { response, text } = await fetchText(`${server.baseUrl}/`)
    expectStatus(response, 200)
    expect(text).toContain('<div id="root"></div>')
    await writeArtifact('http', 'web-index.html', text, ROOT_DIR)
  })

  it('serves the hello API', async () => {
    const { response, json } = await fetchJson<{ message: string; method: string }>(`${server.baseUrl}/api/hello`)
    expectStatus(response, 200)
    expect(json?.message).toBe('Hello, world!')
    expect(json?.method).toBe('GET')
    await writeJsonArtifact('http', 'api-hello.json', json, ROOT_DIR)
  })

  it('serves the named hello API', async () => {
    const { response, json } = await fetchJson<{ message: string }>(`${server.baseUrl}/api/hello/Bun`)
    expectStatus(response, 200)
    expect(json?.message).toBe('Hello, Bun!')
  })

  it('emits startup logs', async () => {
    if (!server.proc.stdout) {
      return
    }
    await waitForOutput(server.proc.stdout, /Started|Starting/, 5000)
    await writeArtifact('logs', 'server-stdout.log', server.proc.stdout.text(), ROOT_DIR)
  })
})
