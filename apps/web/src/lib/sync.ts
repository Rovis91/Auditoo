import { TOKEN_KEY } from '@/contexts'
import { mutationQueue } from './queue'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'
const HEALTH_INTERVAL_MS = 30_000
const PING_TIMEOUT_MS = 2_000

let flushing = false
let started = false

/** Remap client-generated UUIDs (offline) to server ids after successful POST creates. */
function resolveEndpoint(endpoint: string, idMap: Map<string, string>): string {
  let e = endpoint
  for (const [client, server] of idMap) {
    if (client !== server) e = e.replaceAll(client, server)
  }
  return e
}

function resolveBody(body: unknown, idMap: Map<string, string>): unknown {
  if (body == null || typeof body !== 'object') return body
  const o = { ...(body as Record<string, unknown>) }
  for (const key of ['inspectionId', 'levelId', 'level_id', 'spaceId'] as const) {
    const v = o[key]
    if (typeof v === 'string' && idMap.has(v)) o[key] = idMap.get(v)
  }
  return o
}

async function ping(): Promise<boolean> {
  if (!navigator.onLine) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS)
  try {
    await fetch(BASE, { method: 'HEAD', signal: ctrl.signal, mode: 'no-cors' })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function flush(): Promise<void> {
  if (flushing) return
  if (!navigator.onLine) return
  flushing = true
  const idMap = new Map<string, string>()
  try {
    const pending = await mutationQueue.peekAll()
    for (const m of pending) {
      const token = localStorage.getItem(TOKEN_KEY)
      const endpoint = resolveEndpoint(m.endpoint, idMap)
      const body = resolveBody(m.body, idMap)

      try {
        const res = await fetch(`${BASE}${endpoint}`, {
          method: m.method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: m.body == null ? undefined : JSON.stringify(body),
        })
        const text = await res.text()

        if (res.status >= 500) {
          break
        }

        if (res.status >= 200 && res.status < 300) {
          if (m.id != null) await mutationQueue.remove(m.id)
          if (m.method === 'POST' && m.clientEntityId && text.length > 0) {
            try {
              const data = JSON.parse(text) as { id?: string }
              if (data?.id) idMap.set(m.clientEntityId, data.id)
            } catch {
              /* not JSON */
            }
          }
        } else {
          // 4xx — stop; keep remaining mutations (do not drop this one)
          break
        }
      } catch {
        break
      }
    }
  } finally {
    flushing = false
  }
}

export function startSyncManager(): void {
  if (started) return
  started = true

  window.addEventListener('online', () => {
    void flush()
  })

  setInterval(() => {
    void (async () => {
      if (await ping()) await flush()
    })()
  }, HEALTH_INTERVAL_MS)

  void flush()
}
