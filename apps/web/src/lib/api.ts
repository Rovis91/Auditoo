import { TOKEN_KEY } from '@/contexts'
import {
  mutationQueue,
  getCachedResponse,
  setCachedResponse,
  type MutationMethod,
  type VoiceQueuedBody,
} from './queue'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || res.statusText)
  }
  return res.json() as Promise<T>
}

// Convert known camelCase foreign-key fields to the snake_case shape the UI
// expects on DB rows, so an offline-synthesized row can stand in for the
// real server response until the queue flushes.
const FK_MAP: Record<string, string> = {
  inspectionId: 'inspection_id',
  levelId: 'level_id',
  spaceId: 'space_id',
  agentId: 'agent_id',
  companyId: 'company_id',
}

function synthesizeRow<T>(body: unknown): T {
  const now = new Date().toISOString()
  const base: Record<string, unknown> = {
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }
  if (body && typeof body === 'object') {
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      base[FK_MAP[k] ?? k] = v
    }
  }
  return base as T
}

type AnyRecord = Record<string, unknown>

async function primeCachesOnOfflinePost(
  path: string,
  body: unknown,
  synthesized: AnyRecord,
): Promise<void> {
  if (path === '/inspections') {
    await setCachedResponse(`/inspections/${synthesized.id as string}`, {
      ...synthesized,
      levels: [],
    })
    const list = (await getCachedResponse<AnyRecord[]>('/inspections')) ?? []
    await setCachedResponse('/inspections', [...list, synthesized])
    return
  }

  if (path === '/levels') {
    const inspectionId = (body as AnyRecord | null)?.inspectionId as string | undefined
    if (!inspectionId) return
    const url = `/inspections/${inspectionId}`
    const detail = await getCachedResponse<AnyRecord>(url)
    if (!detail) return
    const levels = (detail.levels as AnyRecord[] | undefined) ?? []
    await setCachedResponse(url, {
      ...detail,
      levels: [...levels, { ...synthesized, spaces: [] }],
    })
    return
  }

  if (path === '/spaces') {
    const levelId = (body as AnyRecord | null)?.levelId as string | undefined
    if (!levelId) return
    // Locate the inspection whose detail cache contains this level.
    // In practice only the currently-viewed inspection is cached, so at most
    // one write happens.
    const candidates = await findInspectionsContainingLevel(levelId)
    for (const url of candidates) {
      const detail = await getCachedResponse<AnyRecord>(url)
      if (!detail) continue
      const levels = (detail.levels as AnyRecord[] | undefined) ?? []
      const updatedLevels = levels.map((l) =>
        l.id === levelId
          ? { ...l, spaces: [...((l.spaces as AnyRecord[] | undefined) ?? []), synthesized] }
          : l,
      )
      await setCachedResponse(url, { ...detail, levels: updatedLevels })
    }
  }
}

async function findInspectionsContainingLevel(levelId: string): Promise<string[]> {
  const list = (await getCachedResponse<AnyRecord[]>('/inspections')) ?? []
  const urls: string[] = []
  for (const insp of list) {
    const url = `/inspections/${insp.id as string}`
    const detail = await getCachedResponse<AnyRecord>(url)
    const levels = (detail?.levels as AnyRecord[] | undefined) ?? []
    if (levels.some((l) => l.id === levelId)) urls.push(url)
  }
  return urls
}

async function get<T>(path: string): Promise<T> {
  try {
    const data = await apiFetch<T>(path, { method: 'GET' })
    void setCachedResponse(path, data)
    return data
  } catch (err) {
    const cached = await getCachedResponse<T>(path)
    if (cached !== undefined) return cached
    throw err
  }
}

export type VoiceChange = {
  table: 'inspections' | 'spaces'
  id: string
  field: string
  value: unknown
}

export type PostVoiceResult =
  | {
      status: 'applied'
      changes: VoiceChange[]
      /** Present when the voice pipeline created levels (server response). */
      createdLevels?: unknown[]
      createdSpaces?: unknown[]
    }
  | { status: 'queued' }

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const d = r.result as string
      const i = d.indexOf(',')
      resolve(i >= 0 ? d.slice(i + 1) : d)
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function postVoiceFetch(
  blob: Blob,
  inspectionId: string,
  spaceId: string | undefined,
): Promise<{
  changes: VoiceChange[]
  createdLevels?: unknown[]
  createdSpaces?: unknown[]
}> {
  const token = localStorage.getItem(TOKEN_KEY)
  const fd = new FormData()
  const name = blob.type.includes('webm') ? 'recording.webm' : 'recording'
  fd.append('audio', blob, name)
  fd.append('inspectionId', inspectionId)
  if (spaceId) fd.append('spaceId', spaceId)
  const res = await fetch(`${BASE}/voice`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || res.statusText)
  }
  try {
    const data = JSON.parse(text) as {
      changes?: VoiceChange[]
      createdLevels?: unknown[]
      createdSpaces?: unknown[]
    }
    return {
      changes: data.changes ?? [],
      createdLevels: data.createdLevels,
      createdSpaces: data.createdSpaces,
    }
  } catch {
    return { changes: [] }
  }
}

/**
 * Online: multipart POST /voice. Offline: enqueue base64 payload for sync flush.
 */
export async function postVoice(
  blob: Blob,
  inspectionId: string,
  spaceId?: string,
): Promise<PostVoiceResult> {
  if (navigator.onLine) {
    const payload = await postVoiceFetch(blob, inspectionId, spaceId)
    return {
      status: 'applied',
      changes: payload.changes,
      createdLevels: payload.createdLevels,
      createdSpaces: payload.createdSpaces,
    }
  }
  const audioBase64 = await blobToBase64(blob)
  const body: VoiceQueuedBody = {
    inspectionId,
    spaceId,
    audioBase64,
    mimeType: blob.type || 'audio/webm',
  }
  await mutationQueue.enqueue({
    endpoint: '/voice',
    method: 'POST',
    body,
    timestamp: Date.now(),
    payloadType: 'voice',
  })
  return { status: 'queued' }
}

async function mutate<T>(method: MutationMethod, path: string, body: unknown | null): Promise<T> {
  if (navigator.onLine) {
    return apiFetch<T>(path, {
      method,
      body: body == null ? undefined : JSON.stringify(body),
    })
  }
  if (method === 'POST' && body != null) {
    const synthesized = synthesizeRow<AnyRecord>(body)
    await mutationQueue.enqueue({
      endpoint: path,
      method,
      body,
      timestamp: Date.now(),
      payloadType: 'json',
      clientEntityId: synthesized.id as string,
    })
    await primeCachesOnOfflinePost(path, body, synthesized)
    return synthesized as T
  }
  await mutationQueue.enqueue({
    endpoint: path,
    method,
    body,
    timestamp: Date.now(),
    payloadType: 'json',
  })
  return undefined as T
}

export const api = {
  get,
  post: <T>(path: string, body: unknown) => mutate<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => mutate<T>('PATCH', path, body),
  delete: (path: string) => mutate<void>('DELETE', path, null),
  postVoice,
}
