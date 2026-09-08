import { AsyncLocalStorage } from 'node:async_hooks'

type Timings = Map<string, number>
const timings = new AsyncLocalStorage<Timings>()

export async function measure<T>(name: string, task: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await task()
  } finally {
    const current = timings.getStore()
    if (current) current.set(name, (current.get(name) ?? 0) + performance.now() - start)
  }
}

export function timedRoute<T extends (...args: any[]) => Promise<Response>>(handler: T): T {
  return ((...args: Parameters<T>) => timings.run(new Map(), async () => {
    const response = await measure('total', () => handler(...args))
    const entries = [...timings.getStore().entries()]
    response.headers.set('Server-Timing', entries.map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(', '))
    response.headers.set('Cache-Control', 'private, no-store')
    // Only aggregate durations: never log SQL, request bodies, identifiers or credentials.
    if ((timings.getStore().get('total') ?? 0) >= 1000) {
      console.info('[performance]', Object.fromEntries(entries.map(([name, ms]) => [name, Math.round(ms)])))
    }
    return response
  })) as T
}
