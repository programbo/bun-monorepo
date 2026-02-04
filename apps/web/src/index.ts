import { mkdir, readdir, rm } from 'node:fs/promises'
import { existsSync, openSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { connect, createServer, type Server } from 'node:net'
import path from 'node:path'
import tty from 'node:tty'
import { serve, type BunRequest } from 'bun'
import index from './index.html'

const DEFAULT_PORT = 3000
const MAX_PORT = 65_535
const CONTROL_DIR = path.resolve(import.meta.dir, '..', '..', '.dev')

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

const basePort =
  parsePort(process.env.PORT, 'PORT') ?? DEFAULT_PORT + (parsePort(process.env.PORT_OFFSET, 'PORT_OFFSET') ?? 0)

const serverConfig = {
  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index,

    '/api/hello': {
      async GET(_req: BunRequest) {
        return Response.json({
          message: 'Hello, world!',
          method: 'GET',
        })
      },
      async PUT(_req: BunRequest) {
        return Response.json({
          message: 'Hello, world!',
          method: 'PUT',
        })
      },
    },

    '/api/hello/:name': async (req: BunRequest) => {
      const name = req.params.name
      return Response.json({
        message: `Hello, ${name}!`,
      })
    },
  },

  development: process.env.NODE_ENV !== 'production' && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
} as const

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

type RunningServer = {
  id: string
  name: string
  port?: number
  url?: string
  socket: string
}

const discoverRunningServers = async (): Promise<Map<number, RunningServer>> => {
  if (!existsSync(CONTROL_DIR)) return new Map()
  const entries = await readdir(CONTROL_DIR)
  const servers = new Map<number, RunningServer>()

  await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.sock'))
      .map(async (entry) => {
        const socketPath = path.join(CONTROL_DIR, entry)
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

const startServer = async (
  startPort: number,
  currentId: string,
  runningServers: Map<number, RunningServer>,
  currentName: string,
  allowRestartExisting: boolean,
) => {
  let port = startPort
  while (port <= MAX_PORT) {
    const known = runningServers.get(port)
    if (known) {
      if (allowRestartExisting && known.id === currentId) {
        console.log(`🌐 Existing "${known.name}" server detected on port ${port}.`)
        const restartAck = await sendControlCommand(known.socket, 'restart')
        if (restartAck && restartAck.startsWith('ok:')) {
          const url = restartAck.slice(3)
          console.log(`🔁 Restarted successfully at ${url}`)
        } else {
          console.log(`⚠️ Restart failed: ${restartAck ?? 'unknown error'}`)
        }
        process.exit(0)
      }
      console.log(`🌐 Existing "${known.name}" server detected on port ${port}.`)
    }

    try {
      return serve({ ...serverConfig, port })
    } catch (error) {
      if (isAddressInUse(error)) {
        if (!known) {
          console.log(`🌐 Existing server detected on port ${port}.`)
        }
        port += 1
        continue
      }
      throw error
    }
  }
  throw new Error(`No available port found starting from ${startPort}`)
}

let server: ReturnType<typeof serve>

const stopServer = () => {
  server.stop(true)
}

const restartServer = async (currentId: string, currentName: string) => {
  const preferredPort = server.port ?? basePort
  stopServer()
  const running = await discoverRunningServers()
  server = await startServer(preferredPort, currentId, running, currentName, false)
  console.log(`🔁 Server restarted at ${server.url}`)
}

const handleControlMessage = (message: string, currentId: string, currentName: string) => {
  if (message === 'restart') {
    void restartServer(currentId, currentName)
    return `ok:${server.url}`
  }
  if (message === 'stop') {
    stopServer()
    process.exit(0)
  }
  if (message === 'info') {
    return JSON.stringify({ id: currentId, name: currentName, port: server.port, url: server.url })
  }
  return 'error:unknown-command'
}

const startControlServer = async (controlSocket: string, currentId: string, currentName: string) => {
  await mkdir(CONTROL_DIR, { recursive: true })
  if (existsSync(controlSocket)) {
    await rm(controlSocket, { force: true })
  }
  const controlServer: Server = createServer((socket) => {
    socket.on('data', (data) => {
      try {
        const response = handleControlMessage(data.toString().trim(), currentId, currentName)
        if (response) {
          socket.write(response)
        }
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
}

const setupKeyControls = (currentId: string, currentName: string) => {
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
      stopServer()
      process.exit(0)
    }

    if (key === 'r') {
      void restartServer(currentId, currentName)
      return
    }

    if (key === '\u0003') {
      stopServer()
      process.exit(0)
    }
  })
}

const { id: serverId, name: serverName } = await resolveServerInfo()
const controlSocket = path.join(CONTROL_DIR, `${serverId}.sock`)
const runningServers = await discoverRunningServers()
server = await startServer(basePort, serverId, runningServers, serverName, true)

await startControlServer(controlSocket, serverId, serverName)
setupKeyControls(serverId, serverName)

console.log(`🚀 Server running at ${server.url}`)
console.log('Controls: press r to restart, q to quit')
