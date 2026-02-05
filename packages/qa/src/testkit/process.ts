import { pollUntil } from './time'

export type OutputMatcher = string | RegExp

export interface StreamCollector {
  done: Promise<void>
  text: () => string
  waitFor: (matcher: OutputMatcher, options?: { timeoutMs?: number }) => Promise<string>
}

export interface SpawnOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  stdin?: 'pipe' | 'inherit' | 'ignore'
  stdout?: 'pipe' | 'inherit' | 'ignore'
  stderr?: 'pipe' | 'inherit' | 'ignore'
}

export interface SpawnedProcess {
  proc: Bun.Process
  stdout: StreamCollector | null
  stderr: StreamCollector | null
  kill: (signal?: number | string) => void
  waitForExit: () => Promise<{ exitCode: number; stdout: string; stderr: string }>
}

const matchesOutput = (output: string, matcher: OutputMatcher) => {
  if (typeof matcher === 'string') {
    return output.includes(matcher)
  }
  return matcher.test(output)
}

const createStreamCollector = (stream: ReadableStream<Uint8Array> | null): StreamCollector | null => {
  if (!stream) return null

  const decoder = new TextDecoder()
  let buffer = ''
  let resolveDone: (() => void) | undefined
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  type Waiter = {
    matcher: OutputMatcher
    resolve: (value: string) => void
    reject: (error: Error) => void
    timeoutId?: ReturnType<typeof setTimeout>
  }

  const waiters = new Set<Waiter>()

  const checkWaiters = () => {
    for (const waiter of waiters) {
      if (matchesOutput(buffer, waiter.matcher)) {
        if (waiter.timeoutId) clearTimeout(waiter.timeoutId)
        waiter.resolve(buffer)
        waiters.delete(waiter)
      }
    }
  }

  const finishWaiters = () => {
    for (const waiter of waiters) {
      if (waiter.timeoutId) clearTimeout(waiter.timeoutId)
      waiter.reject(new Error('Stream ended before output matched.'))
    }
    waiters.clear()
  }

  const pump = async () => {
    const reader = stream.getReader()
    try {
      while (true) {
        const { done: isDone, value } = await reader.read()
        if (isDone) break
        buffer += decoder.decode(value, { stream: true })
        checkWaiters()
      }
      buffer += decoder.decode()
    } finally {
      resolveDone?.()
      finishWaiters()
    }
  }

  void pump()

  const waitFor = async (matcher: OutputMatcher, options?: { timeoutMs?: number }) => {
    if (matchesOutput(buffer, matcher)) return buffer
    const timeoutMs = options?.timeoutMs ?? 5000

    return await new Promise<string>((resolve, reject) => {
      const waiter: Waiter = { matcher, resolve, reject }
      waiter.timeoutId = setTimeout(() => {
        waiters.delete(waiter)
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for output.`))
      }, timeoutMs)
      waiters.add(waiter)
    })
  }

  return {
    done,
    text: () => buffer,
    waitFor,
  }
}

export const spawnProcess = (command: string, args: string[] = [], options: SpawnOptions = {}): SpawnedProcess => {
  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: options.env,
    stdin: options.stdin ?? 'ignore',
    stdout: options.stdout ?? 'pipe',
    stderr: options.stderr ?? 'pipe',
  })

  const stdout = createStreamCollector(proc.stdout)
  const stderr = createStreamCollector(proc.stderr)

  const waitForExit = async () => {
    const exitCode = await proc.exited
    await Promise.all([stdout?.done, stderr?.done])
    return { exitCode, stdout: stdout?.text() ?? '', stderr: stderr?.text() ?? '' }
  }

  const kill = (signal?: number | string) => {
    if (signal !== undefined) {
      proc.kill(signal)
    } else {
      proc.kill()
    }
  }

  return { proc, stdout, stderr, kill, waitForExit }
}

export const waitForOutput = async (collector: StreamCollector | null, matcher: OutputMatcher, timeoutMs = 5000) => {
  if (!collector) {
    throw new Error('Output stream is not available (did you set stdout/stderr to "pipe"?)')
  }
  return await collector.waitFor(matcher, { timeoutMs })
}

export const expectOutput = async (collector: StreamCollector | null, matcher: OutputMatcher, timeoutMs = 5000) => {
  const output = await waitForOutput(collector, matcher, timeoutMs)
  if (!matchesOutput(output, matcher)) {
    throw new Error('Expected output was not found.')
  }
  return output
}

export const waitForExit = async (proc: SpawnedProcess) => {
  return await proc.waitForExit()
}

export const waitForQuiet = async (collector: StreamCollector | null, quietMs = 200, timeoutMs = 2000) => {
  if (!collector) return ''
  let last = collector.text()
  await pollUntil(
    () => {
      const current = collector.text()
      const isQuiet = current === last
      last = current
      return isQuiet
    },
    { description: 'quiet output', intervalMs: quietMs, timeoutMs },
  )
  return collector.text()
}
