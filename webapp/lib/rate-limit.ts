const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

interface Entry {
  count: number
  windowStart: number
}

const store = new Map<string, Entry>()

export function checkRateLimit(key: string): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    return { limited: false, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS }
  }

  if (entry.count >= MAX_REQUESTS) {
    const resetIn = WINDOW_MS - (now - entry.windowStart)
    return { limited: true, remaining: 0, resetIn }
  }

  entry.count++
  const remaining = MAX_REQUESTS - entry.count
  const resetIn = WINDOW_MS - (now - entry.windowStart)
  return { limited: false, remaining, resetIn }
}
