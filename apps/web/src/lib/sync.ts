import { TOKEN_KEY } from '@/contexts'
import type { VoiceChange } from './api'
import { mutationQueue, type VoiceQueuedBody } from './queue'
import { API_BASE } from './config'
import { recordVoiceHighlights } from './voice-highlights'

/** Dispatched after a queued `POST /voice` succeeds during flush (detail: `{ inspectionId }`). */
export const VOICE_SYNCED_EVENT = 'auditoo:voice-synced'

const BASE = API_BASE
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

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'audio/webm' })
}

/** True when the API is reachable. Uses `/health` (unauthenticated) — not `BASE` root, which is JWT-protected and returns 401 without a Bearer token. */
async function ping(): Promise<boolean> {
  if (!navigator.onLine) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/health`, { method: 'GET', signal: ctrl.signal })
    return res.ok
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
      const isVoice = m.payloadType === 'voice'
      const body = resolveBody(m.body, idMap)

      try {
        let res: Response
        if (isVoice && m.method === 'POST' && body && typeof body === 'object') {
          const vb = body as VoiceQueuedBody
          const blob = base64ToBlob(vb.audioBase64, vb.mimeType)
          const fd = new FormData()
          const fname = vb.mimeType.includes('webm') ? 'recording.webm' : 'recording'
          fd.append('audio', blob, fname)
          fd.append('inspectionId', vb.inspectionId)
          if (vb.spaceId) fd.append('spaceId', vb.spaceId)
          res = await fetch(`${BASE}${endpoint}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
          })
        } else {
          res = await fetch(`${BASE}${endpoint}`, {
            method: m.method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: m.body == null ? undefined : JSON.stringify(body),
          })
        }
        const text = await res.text()

        if (res.status >= 500) {
          break
        }

        if (res.status >= 200 && res.status < 300) {
          if (m.id != null) await mutationQueue.remove(m.id)
          if (isVoice && body && typeof body === 'object') {
            const vb = body as VoiceQueuedBody
            if (text.length > 0) {
              try {
                const data = JSON.parse(text) as {
                  changes?: VoiceChange[]
                  createdLevels?: unknown[]
                  createdSpaces?: unknown[]
                }
                recordVoiceHighlights(vb.inspectionId, {
                  status: 'applied',
                  changes: data.changes ?? [],
                  createdLevels: data.createdLevels,
                  createdSpaces: data.createdSpaces,
                })
              } catch {
                /* ignore non-JSON voice responses */
              }
            }
            window.dispatchEvent(
              new CustomEvent(VOICE_SYNCED_EVENT, { detail: { inspectionId: vb.inspectionId } }),
            )
          }
          if (m.method === 'POST' && m.clientEntityId && text.length > 0 && !isVoice) {
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
