#!/usr/bin/env bun
import { spawn } from 'bun'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { connect, createServer, type Server } from 'node:net'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '..')

const usage = `
Lightweight dev TUI

Usage:
  bun run dev:tui [--all] [--cwd apps/web] [--] [command...]

Defaults:
  command: bun --hot src/index.ts (only when --cwd is used)
  cwd: apps/web (only when --cwd is used)

Keys:
  r  restart
  q  quit
  o  open browser
`.trim()

type Workspace = {
  name: string
  dir: string
  command: string[]
}

type ParsedArgs = {
  command: string[]
  cwd?: string
  runAll: boolean
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const args = argv.slice(2)
  const command: string[] = []
  let cwd: string | undefined
  let passthrough = false
  let runAll = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--help' || arg === '-h') {
      console.log(usage)
      process.exit(0)
    }

    if (arg === '--all') {
      runAll = true
      continue
    }

    if (arg === '--') {
      passthrough = true
      continue
    }

    if (!passthrough && arg === '--cwd') {
      const next = args[i + 1]
      if (!next) throw new Error('Missing value for --cwd')
      cwd = path.resolve(ROOT_DIR, next)
      i += 1
      continue
    }

    if (passthrough || arg.startsWith('-')) {
      command.push(arg)
      continue
    }

    command.push(arg)
  }

  return { command, cwd, runAll }
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const contents = await readFile(filePath, 'utf8')
  return JSON.parse(contents) as T
}

const getWorkspaceDirs = async (): Promise<string[]> => {
  const rootPkg = await readJson<{ workspaces?: string[] }>(path.join(ROOT_DIR, 'package.json'))
  const patterns = rootPkg.workspaces ?? []
  const dirs = new Set<string>()

  for (const pattern of patterns) {
    const glob = new Bun.Glob(path.join(pattern, 'package.json'))
    for await (const match of glob.scan({ cwd: ROOT_DIR, absolute: true })) {
      dirs.add(path.dirname(match))
    }
  }

  return [...dirs]
}

const getWorkspacesWithDev = async (): Promise<Workspace[]> => {
  const dirs = await getWorkspaceDirs()
  const workspaces: Workspace[] = []

  for (const dir of dirs) {
    const pkg = await readJson<{ name?: string; scripts?: Record<string, string> }>(path.join(dir, 'package.json'))
    if (!pkg.scripts?.dev) continue
    const name = pkg.name ?? path.basename(dir)
    workspaces.push({
      name,
      dir,
      command: ['bun', 'run', '--cwd', dir, 'dev'],
    })
  }

  return workspaces.sort((a, b) => a.name.localeCompare(b.name))
}

const prompt = async (message: string): Promise<string> => {
  process.stdout.write(message)
  return await new Promise<string>((resolve) => {
    process.stdin.once('data', (chunk) => resolve(String(chunk).trim()))
  })
}

const chooseWorkspaces = async (candidates: Workspace[], runAll: boolean): Promise<Workspace[]> => {
  if (candidates.length === 0) {
    throw new Error('No workspaces with a dev script found.')
  }

  if (runAll) return candidates

  console.log('Select workspace(s) to run:')
  candidates.forEach((workspace, index) => {
    console.log(`${index + 1}. ${workspace.name} (${path.relative(ROOT_DIR, workspace.dir)})`)
  })
  console.log('Enter comma-separated numbers or press enter for the first option.')

  const answer = await prompt('> ')
  if (!answer) {
    return [candidates[0]]
  }

  const selections = new Set<number>()
  for (const raw of answer.split(',')) {
    const index = Number(raw.trim())
    if (Number.isInteger(index) && index > 0 && index <= candidates.length) {
      selections.add(index - 1)
    }
  }

  if (selections.size === 0) {
    return [candidates[0]]
  }

  return [...selections].map((index) => candidates[index])
}

const formatLabel = (label: string) => `[${label}] `

const attachOutput = (child: ReturnType<typeof spawn>, label: string, onLine: (line: string) => void) => {
  const decoder = new TextDecoder()
  let buffer = ''

  const writeChunk = (chunk: Uint8Array) => {
    buffer += decoder.decode(chunk)
    let newlineIndex = buffer.indexOf('\n')

    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      onLine(line)
      newlineIndex = buffer.indexOf('\n')
    }
  }

  if (child.stdout) {
    child.stdout.on('data', (chunk) => writeChunk(chunk))
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => writeChunk(chunk))
  }

  child.exited.then(() => {
    if (buffer.length > 0) {
      onLine(buffer)
      buffer = ''
    }
    console.log(`${formatLabel(label)}process exited`)
  })
}

const openBrowser = (url: string) => {
  const command = process.platform === 'darwin' ? ['open', url] : ['xdg-open', url]
  spawn(command, { stdout: 'ignore', stderr: 'ignore' })
}

const main = async () => {
  const { command, cwd, runAll } = parseArgs(process.argv)

  let workspaces: Workspace[]

  if (cwd) {
    const resolved = path.resolve(ROOT_DIR, cwd)
    const finalCommand = command.length > 0 ? command : ['bun', '--hot', 'src/index.ts']
    workspaces = [{ name: path.basename(resolved), dir: resolved, command: finalCommand }]
  } else if (command.length > 0) {
    workspaces = [{ name: 'custom', dir: ROOT_DIR, command }]
  } else {
    const candidates = await getWorkspacesWithDev()
    workspaces = await chooseWorkspaces(candidates, runAll)
  }

  const children = new Map<string, ReturnType<typeof spawn>>()
  const latestUrl = new Map<string, string>()

  const socketId = createHash('sha1')
    .update(workspaces.map((workspace) => workspace.dir).sort().join('|'))
    .digest('hex')
    .slice(0, 8)
  const controlDir = path.join(ROOT_DIR, '.dev')
  const controlSocket = path.join(controlDir, `dev-tui-${socketId}.sock`)
  let controlServer: Server | null = null

  const startAll = () => {
    for (const workspace of workspaces) {
      const child = spawn(workspace.command, {
        cwd: workspace.dir,
        stdin: 'inherit',
        stdout: 'pipe',
        stderr: 'pipe',
      })
      children.set(workspace.name, child)

      attachOutput(child, workspace.name, (line) => {
        console.log(`${formatLabel(workspace.name)}${line}`)
        const match = line.match(/https?:\/\/[^\s]+/)
        if (match) {
          latestUrl.set(workspace.name, match[0])
        }
      })
    }
  }

  const stopAll = async () => {
    await Promise.all(
      [...children.values()].map(async (child) => {
        child.kill()
        await child.exited
      }),
    )
    children.clear()
  }

  let restarting = false

  const restartAll = async () => {
    if (restarting) return
    restarting = true
    await stopAll()
    startAll()
    restarting = false
  }

  const handleControlMessage = async (message: string) => {
    if (message === 'restart') {
      await restartAll()
      return
    }
    if (message === 'open') {
      const first = workspaces.find((workspace) => latestUrl.has(workspace.name))
      if (first) {
        openBrowser(latestUrl.get(first.name) ?? '')
      }
      return
    }
    if (message === 'stop') {
      await shutdown()
    }
  }

  const tryNotifyExisting = async () => {
    if (!existsSync(controlSocket)) return false
    return await new Promise<boolean>((resolve) => {
      const client = connect(controlSocket, () => {
        client.write('restart')
        client.end()
        resolve(true)
      })
      client.on('error', () => resolve(false))
    })
  }

  const startControlServer = async () => {
    await mkdir(controlDir, { recursive: true })
    if (existsSync(controlSocket)) {
      await rm(controlSocket, { force: true })
    }
    controlServer = createServer((socket) => {
      socket.on('data', (data) => {
        void handleControlMessage(data.toString().trim())
      })
    })
    controlServer.listen(controlSocket)
  }

  const shutdown = async () => {
    if (controlServer) {
      await new Promise<void>((resolve) => controlServer?.close(() => resolve()))
      controlServer = null
    }
    if (existsSync(controlSocket)) {
      await rm(controlSocket, { force: true })
    }
    await stopAll()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })

  const stdin = process.stdin
  if (stdin.isTTY) {
    stdin.setRawMode(true)
  }
  stdin.resume()
  stdin.setEncoding('utf8')

  stdin.on('data', (chunk) => {
    const key = chunk.toString()

    if (key === 'q') {
      void shutdown()
      return
    }

    if (key === 'r') {
      void restartAll()
      return
    }

    if (key === 'o') {
      const first = workspaces.find((workspace) => latestUrl.has(workspace.name))
      if (first) {
        openBrowser(latestUrl.get(first.name) ?? '')
      } else {
        console.log('No server URL detected yet.')
      }
      return
    }

    if (key === '\u0003') {
      void shutdown()
    }
  })

  console.log('Dev TUI: press r to restart, q to quit, o to open browser')
  console.log(`Workspaces: ${workspaces.map((workspace) => workspace.name).join(', ')}`)

  if (await tryNotifyExisting()) {
    console.log('Existing dev TUI detected: sent restart signal.')
    process.exit(0)
  }

  await startControlServer()
  startAll()
}

await main()
