#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '../..')

const USAGE = `
Usage:
  bun run web-postinstall --dir <path>
  bun run web-postinstall <path>
`.trim()

const TEMPLATE = `import { serve } from 'bun'
import { connect, createServer, type Server } from 'node:net'
import { existsSync, openSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import tty from 'node:tty'

const DEFAULT_PORT = 3000
const MAX_PORT = 65_535

const parsePort = (value: string | undefined, label: string) => {
  if (!value) return undefined
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > MAX_PORT) {
    console.warn(\`⚠️ Ignoring invalid \${label}: \${value}\`)
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

const createControlPaths = (controlSocket?: string) => {
  const root = process.cwd()
  const defaultDir = path.join(root, '.dev')
  const defaultSocket = path.join(defaultDir, 'web.sock')
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
      return serve({ ...config, port })
    } catch (error) {
      if (isAddressInUse(error)) {
        port += 1
        continue
      }
      throw error
    }
  }
  throw new Error(\`No available port found starting from \${startPort}\`)
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

    if (key === '\\u0003') {
      onStop()
    }
  })
}

export const serveWithControl = async (config: Parameters<typeof serve>[0] & { port?: number }, options?: { controlSocket?: string }) => {
  const basePort = resolveBasePort(config.port)
  const { controlDir, controlSocket } = createControlPaths(options?.controlSocket)

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
      console.log(\`🔁 Existing server detected. Restarted successfully at \${url}\`)
    } else {
      console.log(\`⚠️ Existing server detected. Restart failed: \${restartAck}\`)
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
    console.log(\`🔁 Server restarted at \${server.url}\`)
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
          socket.write(\`ok:\${server.url}\`)
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
        socket.write(\`error:\${message}\`)
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

  return server
}
`

const parseArgs = () => {
  const args = process.argv.slice(2)
  let dir: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--dir') {
      dir = args[i + 1]
      i += 1
      continue
    }
    if (arg && !arg.startsWith('-') && !dir) {
      dir = arg
    }
  }

  if (!dir) {
    console.error('Missing --dir')
    console.log(USAGE)
    process.exit(1)
  }

  return path.resolve(ROOT_DIR, dir)
}

const updateIndex = async (targetDir: string) => {
  const indexPath = path.join(targetDir, 'src', 'index.ts')
  if (!existsSync(indexPath)) return

  const contents = await readFile(indexPath, 'utf8')
  if (contents.includes('serveWithControl')) return
  if (!contents.includes('serve({')) return

  const updated = contents
    .replace("import { serve } from 'bun'", "import { serveWithControl } from './dev/serve-with-control'")
    .replace('const server = serve({', 'const server = await serveWithControl({')

  await writeFile(indexPath, updated, 'utf8')
}

const ensureHelper = async (targetDir: string) => {
  const helperPath = path.join(targetDir, 'src', 'dev', 'serve-with-control.ts')
  await mkdir(path.dirname(helperPath), { recursive: true })
  if (!existsSync(helperPath)) {
    await writeFile(helperPath, TEMPLATE, 'utf8')
  }
}

const main = async () => {
  const dir = parseArgs()
  await ensureHelper(dir)
  await updateIndex(dir)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
