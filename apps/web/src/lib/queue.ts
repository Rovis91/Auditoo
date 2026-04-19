import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type MutationMethod = 'POST' | 'PATCH' | 'DELETE'

export type MutationPayloadType = 'json' | 'voice'

/** Body for queued `POST /voice` (offline); audio as raw base64 (no data: prefix). */
export interface VoiceQueuedBody {
  inspectionId: string
  spaceId?: string
  audioBase64: string
  mimeType: string
}

export interface QueuedMutation {
  id?: number
  endpoint: string
  method: MutationMethod
  body: unknown | null
  timestamp: number
  /** Omit or `json` for JSON bodies; `voice` for multipart replay from `VoiceQueuedBody`. */
  payloadType?: MutationPayloadType
  /** Synthesized UUID used offline; mapped to server `id` after a successful POST flush. */
  clientEntityId?: string
}

interface CachedResponse {
  url: string
  data: unknown
  timestamp: number
}

interface AuditooDB extends DBSchema {
  mutations: {
    key: number
    value: QueuedMutation
  }
  responses: {
    key: string
    value: CachedResponse
  }
}

const DB_NAME = 'auditoo'
const MUTATIONS = 'mutations'
const RESPONSES = 'responses'
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase<AuditooDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AuditooDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(MUTATIONS, { keyPath: 'id', autoIncrement: true })
        }
        if (oldVersion < 2) {
          db.createObjectStore(RESPONSES, { keyPath: 'url' })
        }
        // v3: QueuedMutation may include payloadType + voice body shape (no store shape change)
      },
    })
  }
  return dbPromise
}

type Listener = (size: number) => void
const listeners = new Set<Listener>()

async function notify() {
  const s = await size()
  for (const fn of listeners) fn(s)
}

export async function enqueue(m: Omit<QueuedMutation, 'id'>): Promise<number> {
  const db = await getDb()
  const id = await db.add(MUTATIONS, m as QueuedMutation)
  void notify()
  return id as number
}

export async function peekAll(): Promise<QueuedMutation[]> {
  const db = await getDb()
  const all = await db.getAll(MUTATIONS)
  return all.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
}

export async function remove(id: number): Promise<void> {
  const db = await getDb()
  await db.delete(MUTATIONS, id)
  void notify()
}

export async function size(): Promise<number> {
  const db = await getDb()
  return db.count(MUTATIONS)
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  void size().then(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function getCachedResponse<T>(url: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get(RESPONSES, url)
  return row?.data as T | undefined
}

export async function setCachedResponse(url: string, data: unknown): Promise<void> {
  const db = await getDb()
  await db.put(RESPONSES, { url, data, timestamp: Date.now() })
}

/** Offline mutation queue (IndexedDB). `flush` lives in `@/lib/sync`. */
export const mutationQueue = {
  enqueue,
  peekAll,
  remove,
  size,
  /** Queue length (same as `size`). */
  getStatus: size,
  subscribe,
}
