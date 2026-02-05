import { createConnection, createServer } from 'node:net'
import { pollUntil } from './time'
import { spawnProcess, type SpawnedProcess } from './process'

export interface WaitForPortOptions {
  host?: string
  intervalMs?: number
  timeoutMs?: number
}

export const getFreePort = async (host = '127.0.0.1') => {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, host, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Unable to resolve free port.')
  }
  const port = address.port
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

export const waitForPort = async (
  port: number,
  { host = '127.0.0.1', intervalMs = 100, timeoutMs = 5000 }: WaitForPortOptions = {},
) => {
  return await pollUntil(
    async () =>
      await new Promise<boolean>((resolve) => {
        const socket = createConnection({ host, port }, () => {
          socket.end()
          resolve(true)
        })
        socket.on('error', () => resolve(false))
      }),
    { description: `port ${port}`, intervalMs, timeoutMs },
  )
}

export const waitForUrl = async (
  url: string,
  { intervalMs = 200, timeoutMs = 8000 }: { intervalMs?: number; timeoutMs?: number } = {},
) => {
  return await pollUntil(
    async () => {
      try {
        const response = await fetch(url)
        if (response.ok) return response
        return false
      } catch {
        return false
      }
    },
    { description: `url ${url}`, intervalMs, timeoutMs },
  )
}

export interface StartServerOptions {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string | undefined>
  host?: string
  port?: number
  readyPath?: string
  readyUrl?: string
  readyTimeoutMs?: number
  stdout?: 'pipe' | 'inherit' | 'ignore'
  stderr?: 'pipe' | 'inherit' | 'ignore'
}

export interface RunningServer {
  proc: SpawnedProcess
  host: string
  port: number
  baseUrl: string
  readyUrl: string
  ready: Promise<Response>
  stop: () => Promise<void>
}

export const startServer = async (options: StartServerOptions): Promise<RunningServer> => {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? (await getFreePort(host))
  const readyPath = options.readyPath ?? '/'
  const baseUrl = `http://${host}:${port}`
  const readyUrl = options.readyUrl ?? `${baseUrl}${readyPath}`
  const env = { ...process.env, ...options.env, PORT: String(port) }

  const proc = spawnProcess(options.command, options.args ?? [], {
    cwd: options.cwd,
    env,
    stdout: options.stdout,
    stderr: options.stderr,
  })

  const ready = waitForUrl(readyUrl, { timeoutMs: options.readyTimeoutMs })

  const stop = async () => {
    proc.kill('SIGTERM')
    await proc.waitForExit()
  }

  return { proc, host, port, baseUrl, readyUrl, ready, stop }
}

export const withServer = async <T>(options: StartServerOptions, fn: (server: RunningServer) => Promise<T>) => {
  const server = await startServer(options)
  try {
    await server.ready
    return await fn(server)
  } finally {
    await server.stop()
  }
}
