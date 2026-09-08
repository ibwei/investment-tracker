'use client'

export class RequestError extends Error {
  constructor(message: string, public status = 0, public uncertain = false) { super(message) }
}

export async function requestJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const writing = Boolean(options.method && options.method !== 'GET')
  let response: Response
  try {
    response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  } catch {
    throw new RequestError(writing ? 'request.uncertain' : 'request.failed', 0, writing)
  }
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('earn:session-expired'))
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload) {
    throw new RequestError(payload?.error || (writing ? 'request.uncertain' : 'request.failed'), response.status, writing && (response.status >= 500 || !payload))
  }
  return payload
}

type Entry = { data?: any; updatedAt: number; promise?: Promise<any>; controller?: AbortController }
const cache = new Map<string, Entry>()
export const FRESHNESS_MS = 30_000

export function peekResource<T>(scope: string, url: string): { data?: T; updatedAt: number } {
  return cache.get(`${scope}:${url}`) ?? { updatedAt: 0 }
}

export function readResource<T>(scope: string, url: string, force = false): Promise<T> {
  const key = `${scope}:${url}`
  const previous = cache.get(key)
  if (previous?.promise) return previous.promise
  if (!force && previous?.data !== undefined && Date.now() - previous.updatedAt < FRESHNESS_MS) return Promise.resolve(previous.data)
  const entry: Entry = { data: previous?.data, updatedAt: previous?.updatedAt ?? 0, controller: new AbortController() }
  entry.promise = requestJson<T>(url, { signal: entry.controller.signal }).then(data => {
    if (cache.get(key) === entry) { entry.data = data; entry.updatedAt = Date.now() }
    return data
  }).finally(() => {
    if (cache.get(key) === entry) { entry.promise = undefined; entry.controller = undefined }
  })
  cache.set(key, entry)
  return entry.promise
}

export function seedResource(scope: string, url: string, data: unknown) {
  const key = `${scope}:${url}`
  cache.get(key)?.controller?.abort()
  cache.set(key, { data, updatedAt: Date.now() })
}

export function invalidateResources(scope?: string, prefix = '') {
  for (const [key, entry] of cache) {
    if (!scope || key.startsWith(`${scope}:${prefix}`)) {
      entry.controller?.abort()
      cache.delete(key)
    }
  }
}
