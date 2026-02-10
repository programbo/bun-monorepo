import path from 'node:path'
import { describe, expect, it } from 'bun:test'

const ROOT_DIR = path.resolve(import.meta.dir, '..')
const TEMPLATE_DIR = path.join('packages', '_new', 'templates', 'api')
const isTemplateSource = ROOT_DIR.includes(TEMPLATE_DIR)
const testIt = isTemplateSource ? it.skip : it

const loadApp = async () => {
  const mod = (await import('../src/index')) as { default: { request: (input: string) => Promise<Response> } }
  return mod.default
}

describe('api', () => {
  testIt('serves health status', async () => {
    const app = await loadApp()
    const response = await app.request('/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  testIt('serves hello world', async () => {
    const app = await loadApp()
    const response = await app.request('/api/hello')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'Hello, world!' })
  })

  testIt('serves named hello', async () => {
    const app = await loadApp()
    const response = await app.request('/api/hello/Bun')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'Hello, Bun!' })
  })
})
