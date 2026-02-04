import { mkdir, rm } from 'node:fs/promises'
import { existsSync, openSync } from 'node:fs'
import { connect, createServer, type Server } from 'node:net'
import path from 'node:path'
import tty from 'node:tty'
import { serve, type BunRequest } from 'bun'
import index from './index.html'

const DEFAULT_PORT = 3000
const MAX_PORT = 65_535
const CONTROL_DIR = path.resolve(import.meta.dir, '..', '..', '.dev')
const CONTROL_SOCKET = path.join(CONTROL_DIR, 'web.sock')

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

const startServer = (startPort: number) => {
  let port = startPort
  while (port <= MAX_PORT) {
    try {
      return serve({ ...serverConfig, port })
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

let server = startServer(basePort)

const stopServer = () => {
  server.stop(true)
}

const restartServer = () => {
  const preferredPort = server.port
  stopServer()
  server = startServer(preferredPort ?? basePort)
  console.log(`🔁 Server restarted at ${server.url}`)
}

const handleControlMessage = (message: string) => {
  if (message === 'restart') {
    restartServer()
    return `ok:${server.url}`
  }
  if (message === 'stop') {
    stopServer()
    process.exit(0)
  }
  return 'error:unknown-command'
}

const tryNotifyExisting = async () => {
  if (!existsSync(CONTROL_SOCKET)) return false
  return await new Promise<false | string>((resolve) => {
    const client = connect(CONTROL_SOCKET, () => {
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

const startControlServer = async () => {
  await mkdir(CONTROL_DIR, { recursive: true })
  if (existsSync(CONTROL_SOCKET)) {
    await rm(CONTROL_SOCKET, { force: true })
  }
  const controlServer: Server = createServer((socket) => {
    socket.on('data', (data) => {
      try {
        const response = handleControlMessage(data.toString().trim())
        if (response) {
          socket.write(response)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        socket.write(`error:${message}`)
      }
    })
  })
  controlServer.listen(CONTROL_SOCKET)

  const cleanup = async () => {
    await new Promise<void>((resolve) => controlServer.close(() => resolve()))
    if (existsSync(CONTROL_SOCKET)) {
      await rm(CONTROL_SOCKET, { force: true })
    }
  }

  process.on('SIGINT', () => void cleanup())
  process.on('SIGTERM', () => void cleanup())
}

const setupKeyControls = () => {
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
      restartServer()
      return
    }

    if (key === '\u0003') {
      stopServer()
      process.exit(0)
    }
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

await startControlServer()
setupKeyControls()

console.log(`🚀 Server running at ${server.url}`)
console.log('Controls: press r to restart, q to quit')
