import { TOKEN_KEY } from '@/contexts'
import {
  mutationQueue,
  deleteCachedResponse,
  getCachedResponse,
  listCachedResponseUrls,
  setCachedResponse,
  type MutationMethod,
  type VoiceQueuedBody,
} from './queue'
import { API_BASE } from './config'

const BASE = API_BASE

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
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || res.statusText)
  }
  if (!text.trim()) {
    return undefined as T
  }
  return JSON.parse(text) as T
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

async function primeCachesOnOfflinePatch(path: string, body: unknown): Promise<void> {
  if (typeof body !== 'object' || body === null) return
  const patch = body as AnyRecord

  // PATCH /inspections/:id
  const inspMatch = path.match(/^\/inspections\/([^/]+)$/)
  if (inspMatch) {
    const id = inspMatch[1]
    const detail = await getCachedResponse<AnyRecord>(`/inspections/${id}`)
    if (detail) await setCachedResponse(`/inspections/${id}`, { ...detail, ...patch })
    const list = (await getCachedResponse<AnyRecord[]>('/inspections')) ?? []
    const updated = list.map((r) => r.id === id ? { ...r, ...patch } : r)
    await setCachedResponse('/inspections', updated)
    return
  }

  // PATCH /levels/:id
  const levelMatch = path.match(/^\/levels\/([^/]+)$/)
  if (levelMatch) {
    const levelId = levelMatch[1]
    const list = (await getCachedResponse<AnyRecord[]>('/inspections')) ?? []
    for (const insp of list) {
      const url = `/inspections/${insp.id as string}`
      const detail = await getCachedResponse<AnyRecord>(url)
      const levels = (detail?.levels as AnyRecord[] | undefined) ?? []
      if (levels.some((l) => l.id === levelId)) {
        await setCachedResponse(url, {
          ...detail,
          levels: levels.map((l) => l.id === levelId ? { ...l, ...patch } : l),
        })
        break
      }
    }
    return
  }

  // PATCH /spaces/:id
  const spaceMatch = path.match(/^\/spaces\/([^/]+)$/)
  if (spaceMatch) {
    const spaceId = spaceMatch[1]
    const urls = new Set<string>()
    const list = (await getCachedResponse<AnyRecord[]>('/inspections')) ?? []
    for (const insp of list) {
      urls.add(`/inspections/${insp.id as string}`)
    }
    for (const key of await listCachedResponseUrls()) {
      if (/^\/inspections\/[^/]+$/.test(key)) urls.add(key)
    }
    for (const url of urls) {
      const detail = await getCachedResponse<AnyRecord>(url)
      if (!detail) continue
      const levels = (detail.levels as AnyRecord[] | undefined) ?? []
      let fromLevelId: string | null = null
      let existing: AnyRecord | null = null
      for (const level of levels) {
        const spaces = (level.spaces as AnyRecord[] | undefined) ?? []
        const hit = spaces.find((s) => s.id === spaceId)
        if (hit) {
          fromLevelId = level.id as string
          existing = hit
          break
        }
      }
      if (!fromLevelId || !existing) continue

      const toLevelId = patch.level_id as string | undefined
      const merged = { ...existing, ...patch }
      const movesLevel =
        toLevelId !== undefined
        && toLevelId !== fromLevelId
        && levels.some((l) => l.id === toLevelId)

      if (movesLevel) {
        await setCachedResponse(url, {
          ...detail,
          levels: levels.map((l) => {
            if (l.id === fromLevelId) {
              const spaces = (l.spaces as AnyRecord[] | undefined) ?? []
              return { ...l, spaces: spaces.filter((s) => s.id !== spaceId) }
            }
            if (l.id === toLevelId) {
              const spaces = (l.spaces as AnyRecord[] | undefined) ?? []
              return { ...l, spaces: [...spaces, merged] }
            }
            return l
          }),
        })
      } else {
        await setCachedResponse(url, {
          ...detail,
          levels: levels.map((l) =>
            l.id === fromLevelId
              ? {
                  ...l,
                  spaces: ((l.spaces as AnyRecord[] | undefined) ?? []).map((s) =>
                    s.id === spaceId ? merged : s,
                  ),
                }
              : l,
          ),
        })
      }
      return
    }
  }
}

/** `/inspections/:id` → id, or null if path does not match. */
function inspectionIdFromDeletePath(path: string): string | null {
  const m = path.match(/^\/inspections\/([^/]+)$/)
  return m?.[1] ?? null
}

/** Remove inspection from cached list and drop cached detail (offline-first DELETE). */
async function primeCachesOnInspectionDelete(inspectionId: string): Promise<void> {
  const list = (await getCachedResponse<AnyRecord[]>('/inspections')) ?? []
  const filtered = list.filter((row) => row.id !== inspectionId)
  if (filtered.length !== list.length) {
    await setCachedResponse('/inspections', filtered)
  }
  await deleteCachedResponse(`/inspections/${inspectionId}`)
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
    throw new Error(
      text.trim() ? `Invalid JSON from voice API: ${text.slice(0, 300)}` : 'Invalid JSON from voice API (empty body)',
    )
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
    const result = await apiFetch<T>(path, {
      method,
      body: body == null ? undefined : JSON.stringify(body),
    })
    if (method === 'DELETE') {
      const id = inspectionIdFromDeletePath(path)
      if (id) await primeCachesOnInspectionDelete(id)
    }
    return result
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
  if (method === 'DELETE') {
    await mutationQueue.enqueue({
      endpoint: path,
      method,
      body,
      timestamp: Date.now(),
      payloadType: 'json',
    })
    const id = inspectionIdFromDeletePath(path)
    if (id) await primeCachesOnInspectionDelete(id)
    return undefined as T
  }
  await mutationQueue.enqueue({
    endpoint: path,
    method,
    body,
    timestamp: Date.now(),
    payloadType: 'json',
  })
  if (body != null) await primeCachesOnOfflinePatch(path, body)
  return undefined as T
}

export const api = {
  get,
  post: <T>(path: string, body: unknown) => mutate<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => mutate<T>('PATCH', path, body),
  delete: (path: string) => mutate<void>('DELETE', path, null),
  postVoice,
}
