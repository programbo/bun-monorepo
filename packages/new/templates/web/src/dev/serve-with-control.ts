import { mkdir, readdir, rm } from 'node:fs/promises'
import { existsSync, openSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { connect, createServer, type Server } from 'node:net'
import path from 'node:path'
import tty from 'node:tty'
import { serve, spawn } from 'bun'

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

const resolveServerInfo = async () => {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    const contents = await Bun.file(pkgPath).text()
    const pkg = JSON.parse(contents) as { name?: string }
    const name = pkg.name ?? path.basename(process.cwd())
    const hash = createHash('sha1').update(process.cwd()).digest('hex').slice(0, 6)
    return { id: `${name}-${hash}`, name }
  } catch {
    const name = path.basename(process.cwd())
    const hash = createHash('sha1').update(process.cwd()).digest('hex').slice(0, 6)
    return { id: `${name}-${hash}`, name }
  }
}

const createControlPaths = async (controlSocket?: string) => {
  const root = process.cwd()
  const defaultDir = path.join(root, '.dev')
  const { id } = await resolveServerInfo()
  const defaultSocket = path.join(defaultDir, `${id}.sock`)
  if (!controlSocket) {
    return { controlDir: defaultDir, controlSocket: defaultSocket }
  }
  const resolved = path.isAbsolute(controlSocket) ? controlSocket : path.resolve(root, controlSocket)
  return { controlDir: path.dirname(resolved), controlSocket: resolved }
}

const setupKeyControls = (onRestart: () => void, onStop: () => void, onOpenBrowser: () => void) => {
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

    if (key === 'o') {
      onOpenBrowser()
      return
    }

    if (key === '\u0003') {
      onStop()
    }
  })
}

type RunningServer = {
  id: string
  name: string
  port?: number
  url?: string
  socket: string
}

const sendControlCommand = async (socketPath: string, message: string) => {
  return await new Promise<false | string>((resolve) => {
    const client = connect(socketPath, () => {
      client.write(message)
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

const discoverRunningServers = async (controlDir: string): Promise<Map<number, RunningServer>> => {
  if (!existsSync(controlDir)) return new Map()
  const entries = await readdir(controlDir)
  const servers = new Map<number, RunningServer>()

  await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.sock'))
      .map(async (entry) => {
        const socketPath = path.join(controlDir, entry)
        const response = await sendControlCommand(socketPath, 'info')
        if (!response) return
        try {
          const info = JSON.parse(response) as { id: string; name: string; port?: number; url?: string }
          if (typeof info.port === 'number') {
            servers.set(info.port, { ...info, socket: socketPath })
          }
        } catch {
          // ignore
        }
      }),
  )

  return servers
}

const startServerWithAwareness = async (
  config: Parameters<typeof serve>[0],
  startPort: number,
  currentId: string,
  currentName: string,
  runningServers: Map<number, RunningServer>,
  allowRestartExisting: boolean,
) => {
  let port = startPort
  let replacedExisting = false
  while (port <= MAX_PORT) {
    const known = runningServers.get(port)
    if (known) {
      const label = known.id === currentId ? '🟢' : '🔵'
      console.log(`${label} Existing "${known.name}" server detected on port ${port}.`)
      if (allowRestartExisting && known.id === currentId) {
        const stopAck = await sendControlCommand(known.socket, 'stop')
        if (stopAck && stopAck.startsWith('ok')) {
          replacedExisting = true
        } else {
          console.log(`⚠️ Restart failed: ${stopAck ?? 'unknown error'}`)
        }
      }
    }

    try {
      const started = serve({ ...config, port } as Bun.Serve.Options<undefined>)
      if (replacedExisting) {
        console.log(`♻️ Restarted successfully at ${started.url}`)
      }
      return started
    } catch (error) {
      if (isAddressInUse(error)) {
        if (!known) {
          console.log(`⚫ Existing server detected on port ${port}.`)
        }
        port += 1
        continue
      }
      throw error
    }
  }
  throw new Error(`No available port found starting from ${startPort}`)
}

export const serveWithControl = async (
  config: Parameters<typeof serve>[0] & { port?: number },
  options?: { controlSocket?: string },
) => {
  const basePort = resolveBasePort(config.port)
  const { id: serverId, name: serverName } = await resolveServerInfo()
  const { controlDir, controlSocket } = await createControlPaths(options?.controlSocket)

  const runningServers = await discoverRunningServers(controlDir)
  let server = await startServerWithAwareness(config, basePort, serverId, serverName, runningServers, true)
  let controlCleanup: (() => Promise<void>) | null = null

  const stopServer = () => {
    server.stop(true)
  }

  const shutdown = async () => {
    stopServer()
    if (controlCleanup) {
      await controlCleanup()
    }
    process.exit(0)
  }

  const restartServer = async () => {
    const preferredPort = server.port ?? basePort
    server.stop(true)
    const current = await discoverRunningServers(controlDir)
    server = await startServerWithAwareness(config, preferredPort, serverId, serverName, current, false)
    console.log(`🔁 Server restarted at ${server.url}`)
  }

  const openBrowser = () => {
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
    spawn([command, server.url.toString()], { stdout: 'ignore', stderr: 'ignore' })
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
            void restartServer()
            socket.write(`ok:${server.url}`)
            return
          }
          if (message === 'stop') {
            socket.write('ok')
            void shutdown()
            return
          }
          if (message === 'info') {
            socket.write(JSON.stringify({ id: serverId, name: serverName, port: server.port, url: server.url }))
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
  controlCleanup = cleanup

  process.on('SIGINT', () => void cleanup())
  process.on('SIGTERM', () => void cleanup())

  setupKeyControls(() => void restartServer(), () => void shutdown(), openBrowser)
  console.log(`🔌 Control socket: ${path.relative(process.cwd(), controlSocket)}`)
  console.log('🎹 Controls: press r to restart, q to quit, o to open browser')

  return server
}
