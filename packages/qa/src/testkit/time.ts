export interface PollOptions {
  description?: string
  intervalMs?: number
  timeoutMs?: number
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isReady = (value: unknown) => value !== false && value !== undefined && value !== null

export const pollUntil = async <T>(
  fn: () => Promise<T> | T,
  { description = 'condition', intervalMs = 100, timeoutMs = 5000 }: PollOptions = {},
): Promise<T> => {
  const start = Date.now()
  let lastError: unknown

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn()
      if (isReady(result)) {
        return result
      }
    } catch (error) {
      lastError = error
    }

    await sleep(intervalMs)
  }

  const errorSuffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : ''
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}.${errorSuffix}`)
}
