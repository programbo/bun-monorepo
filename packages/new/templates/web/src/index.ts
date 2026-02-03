import { serve } from 'bun'
import index from './index.html'

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

const basePort = parsePort(process.env.PORT, 'PORT') ?? (DEFAULT_PORT + (parsePort(process.env.PORT_OFFSET, 'PORT_OFFSET') ?? 0))

const serverConfig = {
  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index,

    '/api/hello': {
      async GET(_req) {
        return Response.json({
          message: 'Hello, world!',
          method: 'GET',
        })
      },
      async PUT(_req) {
        return Response.json({
          message: 'Hello, world!',
          method: 'PUT',
        })
      },
    },

    '/api/hello/:name': async (req) => {
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

const server = startServer(basePort)

console.log(`🚀 Server running at ${server.url}`)
