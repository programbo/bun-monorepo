export const fetchText = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init)
  const text = await response.text()
  return { response, text }
}

export const fetchJson = async <T>(url: string, init?: RequestInit) => {
  const response = await fetch(url, init)
  const text = await response.text()
  let json: T | null = null
  try {
    json = JSON.parse(text) as T
  } catch {
    json = null
  }
  return { response, text, json }
}

export const expectStatus = (response: Response, expected: number | number[]) => {
  const expectedList = Array.isArray(expected) ? expected : [expected]
  if (!expectedList.includes(response.status)) {
    throw new Error(`Expected status ${expectedList.join(', ')}, got ${response.status}`)
  }
}

export const timedFetch = async (url: string, init?: RequestInit) => {
  const start = performance.now()
  const response = await fetch(url, init)
  const elapsedMs = performance.now() - start
  return { response, elapsedMs }
}
