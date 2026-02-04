import { mkdir, rm } from 'node:fs/promises'
import { existsSync, openSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { connect, createServer, type Server } from 'node:net'
import path from 'node:path'
import tty from 'node:tty'
import { serve } from 'bun'

const DEFAULT_PORT = 3000
const MAX_PORT = 65_535

const parsePort = (value: string | undefined, label: string) => {
  if (!value) return undefined
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > MAX_PORT) {
    console.warn(`⚠️ Ignoring invalid ${label}: ${value}`)
    return undefined
  }
  return port
}

const isAddressInUse = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === 'EADDRINUSE') return true
  if ('message' in error && typeof error.message === 'string') {
    return error.message.includes('EADDRINUSE')
  }
  return false
}

const resolveBasePort = (explicit?: number) => {
  if (explicit) return explicit
  return parsePort(process.env.PORT, 'PORT') ?? DEFAULT_PORT + (parsePort(process.env.PORT_OFFSET, 'PORT_OFFSET') ?? 0)
}

const resolveServerId = async () => {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    const contents = await Bun.file(pkgPath).text()
    const pkg = JSON.parse(contents) as { name?: string }
    const baseName = pkg.name ?? path.basename(process.cwd())
    const hash = createHash('sha1').update(process.cwd()).digest('hex').slice(0, 6)
    return `${baseName}-${hash}`
  } catch {
    const hash = createHash('sha1').update(process.cwd()).digest('hex').slice(0, 6)
    return `${path.basename(process.cwd())}-${hash}`
  }
}

const createControlPaths = async (controlSocket?: string) => {
  const root = process.cwd()
  const defaultDir = path.join(root, '.dev')
  const serverId = await resolveServerId()
  const defaultSocket = path.join(defaultDir, `${serverId}.sock`)
  if (!controlSocket) {
    return { controlDir: defaultDir, controlSocket: defaultSocket }
  }
  const resolved = path.isAbsolute(controlSocket) ? controlSocket : path.resolve(root, controlSocket)
  return { controlDir: path.dirname(resolved), controlSocket: resolved }
}

const startServer = (config: Parameters<typeof serve>[0], startPort: number) => {
  let port = startPort
  while (port <= MAX_PORT) {
    try {
      return serve({ ...config, port } as Bun.Serve.Options<undefined>)
    } catch (error) {
      if (isAddressInUse(error)) {
        port += 1
        continue
      }
      throw error
    }
  }
  throw new Error(`No available port found starting from ${startPort}`)
}

const setupKeyControls = (onRestart: () => void, onStop: () => void) => {
  let input: tty.ReadStream
  if (process.stdin.isTTY) {
    input = process.stdin as tty.ReadStream
  } else {
    try {
      const fd = openSync('/dev/tty', 'r')
      input = new tty.ReadStream(fd)
    } catch {
      return
    }
  }

  input.setRawMode(true)
  input.resume()
  input.setEncoding('utf8')

  input.on('data', (chunk) => {
    const key = chunk.toString()

    if (key === 'q') {
      onStop()
      return
    }

    if (key === 'r') {
      onRestart()
      return
    }

    if (key === '\u0003') {
      onStop()
    }
  })
}

export const serveWithControl = async (
  config: Parameters<typeof serve>[0] & { port?: number },
  options?: { controlSocket?: string },
) => {
  const basePort = resolveBasePort(config.port)
  const { controlDir, controlSocket } = await createControlPaths(options?.controlSocket)

  const tryNotifyExisting = async () => {
    if (!existsSync(controlSocket)) return false
    return await new Promise<false | string>((resolve) => {
      const client = connect(controlSocket, () => {
        client.write('restart')
      })
      const timeout = setTimeout(() => {
        client.destroy()
        resolve(false)
      }, 1000)
      client.on('data', (data) => {
        clearTimeout(timeout)
        resolve(data.toString().trim())
        client.end()
      })
      client.on('error', () => {
        clearTimeout(timeout)
        resolve(false)
      })
    })
  }

  const restartAck = await tryNotifyExisting()
  if (restartAck) {
    if (restartAck.startsWith('ok:')) {
      const url = restartAck.slice(3)
      console.log(`🔁 Existing server detected. Restarted successfully at ${url}`)
    } else {
      console.log(`⚠️ Existing server detected. Restart failed: ${restartAck}`)
    }
    process.exit(0)
  }

  let server = startServer(config, basePort)

  const stopServer = () => {
    server.stop(true)
    process.exit(0)
  }

  const restartServer = () => {
    const preferredPort = server.port ?? basePort
    server.stop(true)
    server = startServer(config, preferredPort)
    console.log(`🔁 Server restarted at ${server.url}`)
  }

  await mkdir(controlDir, { recursive: true })
  if (existsSync(controlSocket)) {
    await rm(controlSocket, { force: true })
  }

  const controlServer: Server = createServer((socket) => {
    socket.on('data', (data) => {
      try {
        const message = data.toString().trim()
        if (message === 'restart') {
          restartServer()
          socket.write(`ok:${server.url}`)
          return
        }
        if (message === 'stop') {
          socket.write('ok')
          stopServer()
          return
        }
        socket.write('error:unknown-command')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        socket.write(`error:${message}`)
      }
    })
  })
  controlServer.listen(controlSocket)

  const cleanup = async () => {
    await new Promise<void>((resolve) => controlServer.close(() => resolve()))
    if (existsSync(controlSocket)) {
      await rm(controlSocket, { force: true })
    }
  }

  process.on('SIGINT', () => void cleanup())
  process.on('SIGTERM', () => void cleanup())

  setupKeyControls(restartServer, stopServer)
  console.log('Controls: press r to restart, q to quit')

  return server
}
