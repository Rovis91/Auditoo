import type { PostVoiceResult, VoiceChange } from '@/lib/api'

const STORAGE_PREFIX = 'auditoo:voice-hl:v1:'
const MAX_AGE_MS = 45 * 60 * 1000

export type VoiceHighlightTone = 'new' | 'edit'

type StoredPayload = {
  recordedAt: number
  newLevelIds: string[]
  newSpaceIds: string[]
  /** `table:entityId:field` → tone for that field */
  fields: Record<string, VoiceHighlightTone>
}

function key(table: string, entityId: string, field: string) {
  return `${table}:${entityId}:${field}`
}

/** Aligné sur les defaults d’insert `buildSpaceInsertRow` côté API ([apps/api/src/routes/voice.ts]). */
const VOICE_CREATED_SPACE_DEFAULTS: Record<string, unknown> = {
  area: null,
  window_count: null,
  glazing_type: null,
  heating_presence: false,
  heating_type: null,
  ventilation_presence: false,
  ventilation_type: null,
  insulation_rating: null,
}

const VOICE_CREATED_SPACE_FIELD_KEYS = [
  'name',
  'area',
  'window_count',
  'glazing_type',
  'heating_presence',
  'heating_type',
  'ventilation_presence',
  'ventilation_type',
  'insulation_rating',
] as const

function mergeCreatedSpacesIntoFields(
  createdSpaces: { id: string; [k: string]: unknown }[] | undefined,
  fields: Record<string, VoiceHighlightTone>,
) {
  for (const row of createdSpaces ?? []) {
    const id = row.id
    if (!id) continue
    for (const field of VOICE_CREATED_SPACE_FIELD_KEYS) {
      const k = key('spaces', id, field)
      if (fields[k]) continue
      const v = row[field]
      if (field === 'name') {
        if (isSubstantiveVoiceHighlightValue(v)) fields[k] = 'new'
        continue
      }
      if (Object.prototype.hasOwnProperty.call(VOICE_CREATED_SPACE_DEFAULTS, field)) {
        const d = VOICE_CREATED_SPACE_DEFAULTS[field]
        if (v === d) continue
      }
      if (!isSubstantiveVoiceHighlightValue(v)) continue
      fields[k] = 'new'
    }
  }
}

function read(inspectionId: string): StoredPayload | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + inspectionId)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<StoredPayload> & { recordedAt?: number }
    if (typeof data.recordedAt !== 'number' || Date.now() - data.recordedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_PREFIX + inspectionId)
      return null
    }
    return {
      recordedAt: data.recordedAt ?? Date.now(),
      newLevelIds: data.newLevelIds ?? [],
      newSpaceIds: data.newSpaceIds ?? [],
      fields: data.fields ?? {},
    }
  } catch {
    return null
  }
}

function write(inspectionId: string, payload: StoredPayload) {
  sessionStorage.setItem(STORAGE_PREFIX + inspectionId, JSON.stringify(payload))
}

function remove(inspectionId: string) {
  sessionStorage.removeItem(STORAGE_PREFIX + inspectionId)
}

/** Drop all voice highlights for this inspection (e.g. when leaving `/inspections/$id`). */
export function clearVoiceHighlights(inspectionId: string) {
  if (!inspectionId) return
  remove(inspectionId)
}

/** Pas de surlignage « nouveau » (vert) pour valeurs vides / zéro (selects, nombres, etc.). */
export function isSubstantiveVoiceHighlightValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (value === '') return false
  if (value === '0') return false
  if (typeof value === 'number' && (Number.isNaN(value) || value === 0)) return false
  return true
}

/** Persist highlights from a successful voice response (call from VoiceBar). */
export function recordVoiceHighlights(
  inspectionId: string,
  result: Extract<PostVoiceResult, { status: 'applied' }>,
) {
  const newLevelIds =
    (result.createdLevels as { id: string }[] | undefined)?.map((l) => l.id) ?? []
  const newSpaceIds =
    (result.createdSpaces as { id: string }[] | undefined)?.map((s) => s.id) ?? []
  const newSpaceSet = new Set(newSpaceIds)

  const fields: Record<string, VoiceHighlightTone> = {}

  for (const ch of result.changes ?? []) {
    const tone: VoiceHighlightTone =
      ch.table === 'spaces' && newSpaceSet.has(ch.id) ? 'new' : 'edit'
    if (tone === 'new' && !isSubstantiveVoiceHighlightValue(ch.value)) continue

    const k = key(ch.table, ch.id, ch.field)
    fields[k] = tone
  }

  mergeCreatedSpacesIntoFields(
    result.createdSpaces as { id: string; [k: string]: unknown }[] | undefined,
    fields,
  )

  write(inspectionId, {
    recordedAt: Date.now(),
    newLevelIds,
    newSpaceIds,
    fields,
  })
}

export function getFieldTone(
  inspectionId: string,
  table: VoiceChange['table'],
  entityId: string,
  field: string,
): VoiceHighlightTone | null {
  const s = read(inspectionId)
  if (!s) return null
  const k = key(table, entityId, field)
  if (s.fields[k]) return s.fields[k]
  return null
}

function spaceHasFieldHints(s: StoredPayload, spaceId: string): { hasNew: boolean; hasEdit: boolean } {
  let hasNew = false
  let hasEdit = false
  for (const [entry, tone] of Object.entries(s.fields)) {
    if (!entry.startsWith(`spaces:${spaceId}:`)) continue
    if (tone === 'new') hasNew = true
    if (tone === 'edit') hasEdit = true
  }
  return { hasNew, hasEdit }
}

export function getSpaceRowTone(inspectionId: string, spaceId: string): VoiceHighlightTone | null {
  const s = read(inspectionId)
  if (!s) return null
  const { hasNew, hasEdit } = spaceHasFieldHints(s, spaceId)
  if (s.newSpaceIds.includes(spaceId) && hasNew) return 'new'
  if (hasEdit) return 'edit'
  return null
}

/** Nombre de champs en ton `new` pour cette pièce (dérivé des clés `fields`, pas de store séparé). */
export function getSpaceChangeBadgeCount(inspectionId: string, spaceId: string): number {
  const s = read(inspectionId)
  if (!s) return 0
  const p = `spaces:${spaceId}:`
  let n = 0
  for (const [entry, tone] of Object.entries(s.fields)) {
    if (!entry.startsWith(p)) continue
    if (tone === 'new') n++
  }
  return n
}

export function getLevelRowTone(inspectionId: string, levelId: string): VoiceHighlightTone | null {
  const s = read(inspectionId)
  if (!s) return null
  return s.newLevelIds.includes(levelId) ? 'new' : null
}

function isPayloadEmpty(p: StoredPayload): boolean {
  return Object.keys(p.fields).length === 0 && p.newLevelIds.length === 0 && p.newSpaceIds.length === 0
}

function stripSpaceFields(s: StoredPayload, spaceId: string): StoredPayload {
  const prefix = `spaces:${spaceId}:`
  const fields = { ...s.fields }
  for (const k of Object.keys(fields)) {
    if (k.startsWith(prefix)) delete fields[k]
  }
  return {
    ...s,
    newSpaceIds: s.newSpaceIds.filter((id) => id !== spaceId),
    fields,
  }
}

export function consumeField(
  inspectionId: string,
  table: VoiceChange['table'],
  entityId: string,
  field: string,
) {
  const s = read(inspectionId)
  if (!s) return
  const k = key(table, entityId, field)
  const bulkNewSpace = table === 'spaces' && s.newSpaceIds.includes(entityId)
  if (!s.fields[k] && !bulkNewSpace) return

  let next: StoredPayload = { ...s, fields: { ...s.fields } }
  delete next.fields[k]
  if (bulkNewSpace) {
    next = stripSpaceFields(next, entityId)
  }
  if (isPayloadEmpty(next)) {
    remove(inspectionId)
    return
  }
  write(inspectionId, next)
}

/** Clear row-level “new space” and all field hints for that space (e.g. list row click). */
export function consumeSpaceRow(inspectionId: string, spaceId: string) {
  const s = read(inspectionId)
  if (!s) return
  const next = stripSpaceFields(s, spaceId)
  if (isPayloadEmpty(next)) {
    remove(inspectionId)
    return
  }
  write(inspectionId, next)
}

export function consumeLevelRow(inspectionId: string, levelId: string) {
  const s = read(inspectionId)
  if (!s || !s.newLevelIds.includes(levelId)) return
  const newLevelIds = s.newLevelIds.filter((id) => id !== levelId)
  const next = { ...s, newLevelIds }
  if (isPayloadEmpty(next)) {
    remove(inspectionId)
    return
  }
  write(inspectionId, next)
}

/** Where the highlight is drawn so radius matches the surface (cards vs inputs). */
export type VoiceHighlightSurface = 'control' | 'card' | 'cardTop'

function voiceHighlightPaint(tone: VoiceHighlightTone): string {
  if (tone === 'new') {
    return 'ring-2 ring-inset ring-emerald-500/50 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)] bg-emerald-500/[0.07]'
  }
  return 'ring-2 ring-inset ring-amber-500/50 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.25)] bg-amber-500/[0.07]'
}

export function voiceHighlightClass(
  tone: VoiceHighlightTone | null | undefined,
  surface: VoiceHighlightSurface = 'control',
): string {
  if (!tone) return ''
  const radius =
    surface === 'control' ? 'rounded-md' : surface === 'card' ? 'rounded-lg' : 'rounded-t-lg'
  return `${radius} ${voiceHighlightPaint(tone)}`
}

/** @deprecated Use {@link voiceHighlightClass} with a {@link VoiceHighlightSurface}. */
export function voiceHighlightRingClass(tone: VoiceHighlightTone | null | undefined): string {
  return voiceHighlightClass(tone ?? null, 'control')
}
