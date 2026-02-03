#!/usr/bin/env bun
import { spawn } from 'bun'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dir, '..')

const usage = `
Lightweight dev TUI

Usage:
  bun run dev:tui [--cwd apps/web] [--] [command...]

Defaults:
  command: bun --hot src/index.ts
  cwd: apps/web

Keys:
  r  restart
  q  quit
`.trim()

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2)
  let cwd = path.join(ROOT_DIR, 'apps', 'web')
  const command: string[] = []
  let passthrough = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--help' || arg === '-h') {
      console.log(usage)
      process.exit(0)
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

    // If a raw command is passed (without --), treat it as part of the command.
    command.push(arg)
  }

  if (command.length === 0) {
    command.push('bun', '--hot', 'src/index.ts')
  }

  return { command, cwd }
}

const { command, cwd } = parseArgs(process.argv)

let child: ReturnType<typeof spawn> | null = null
let restarting = false

const start = () => {
  child = spawn(command, {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
}

const stop = async () => {
  if (!child) return
  child.kill()
  await child.exited
  child = null
}

const restart = async () => {
  if (restarting) return
  restarting = true
  await stop()
  start()
  restarting = false
}

const shutdown = async () => {
  await stop()
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
    void restart()
    return
  }

  if (key === '\u0003') {
    void shutdown()
  }
})

console.log('Dev TUI: press r to restart, q to quit')
console.log(`Working directory: ${cwd}`)
console.log(`Command: ${command.join(' ')}`)

start()
