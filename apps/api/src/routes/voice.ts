import { Hono } from 'hono'
import { generateKeyBetween } from 'fractional-indexing'
import OpenAI from 'openai'
import type { Tables, TablesInsert } from '../../../../database.types.js'
import { supabase } from '../lib/supabase.js'
import type { AppEnv } from '../types.js'

export const voiceRouter = new Hono<AppEnv>()

const INSPECTION_FIELDS: readonly (keyof Tables<'inspections'>)[] = [
  'owner_name', 'address', 'date', 'status', 'construction_year',
  'living_area', 'heating_type', 'hot_water_system', 'ventilation_type', 'insulation_context',
]
const SPACE_FIELDS: readonly (keyof Tables<'spaces'>)[] = [
  'name', 'area', 'window_count', 'glazing_type', 'heating_presence',
  'heating_type', 'ventilation_presence', 'ventilation_type', 'insulation_rating',
]

/** Applied field update (response only uses uuid ids). */
type Change = {
  table: 'inspections' | 'spaces'
  id: string
  field: string
  value: unknown
}

/** Raw change from model — spaces may target an existing id OR a just-created row by index. */
type RawChange = {
  table: 'inspections' | 'spaces'
  id?: string
  newSpaceIndex?: number
  field: string
  value: unknown
}

type LevelWithSpaces = Tables<'levels'> & { spaces: Tables<'spaces'>[] }

const SPACE_OPTIONAL_ON_CREATE = [
  'area',
  'window_count',
  'glazing_type',
  'heating_presence',
  'heating_type',
  'ventilation_presence',
  'ventilation_type',
  'insulation_rating',
] as const satisfies readonly (keyof Tables<'spaces'>)[]

type CreateSpaceInput = {
  name: string
  levelId?: string
  newLevelIndex?: number
} & Partial<Pick<Tables<'spaces'>, (typeof SPACE_OPTIONAL_ON_CREATE)[number]>>

type ParsedVoice = {
  changes?: RawChange[]
  createLevels?: { label: string }[]
  createSpaces?: CreateSpaceInput[]
}

function sortedLevels(levels: LevelWithSpaces[]): LevelWithSpaces[] {
  return [...levels].sort((a, b) =>
    a.fractional_index < b.fractional_index ? -1 : 1,
  )
}

function sortedSpaces(spaces: Tables<'spaces'>[]): Tables<'spaces'>[] {
  return [...spaces].sort((a, b) =>
    a.fractional_index < b.fractional_index ? -1 : 1,
  )
}

function keyAfterLevels(levels: LevelWithSpaces[]): string {
  const s = sortedLevels(levels)
  const last = s.at(-1)
  return generateKeyBetween(last?.fractional_index ?? null, null)
}

function keyAfterSpaces(spaces: Tables<'spaces'>[]): string {
  const s = sortedSpaces(spaces)
  const last = s.at(-1)
  return generateKeyBetween(last?.fractional_index ?? null, null)
}

/** Merge optional voice fields into a new space insert row (defaults match REST route). */
function buildSpaceInsertRow(
  resolvedLevelId: string,
  name: string,
  fractional_index: string,
  ns: CreateSpaceInput,
): TablesInsert<'spaces'> {
  const row: TablesInsert<'spaces'> = {
    level_id: resolvedLevelId,
    name,
    fractional_index,
    area: null,
    window_count: null,
    glazing_type: null,
    heating_presence: false,
    heating_type: null,
    ventilation_presence: false,
    ventilation_type: null,
    insulation_rating: null,
  }
  for (const key of SPACE_OPTIONAL_ON_CREATE) {
    if (key in ns && (ns as Record<string, unknown>)[key] !== undefined) {
      ;(row as Record<string, unknown>)[key] = (ns as Record<string, unknown>)[key]
    }
  }
  return row
}

voiceRouter.post('/', async (c) => {
  const key = process.env.OPENAI_API_KEY
  if (!key?.trim()) {
    return c.json({ error: 'OPENAI_API_KEY is not configured' }, 400)
  }
  const openai = new OpenAI({ apiKey: key })

  const { companyId } = c.get('auth')

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid multipart body' }, 400)
  }

  const audioFile = formData.get('audio') as File | null
  const inspectionId = formData.get('inspectionId') as string | null
  const spaceId = formData.get('spaceId') as string | null

  if (!audioFile || !inspectionId) {
    return c.json({ error: 'audio and inspectionId are required' }, 400)
  }

  const { data: inspection } = await supabase
    .from('inspections')
    .select('*, levels(*, spaces(*))')
    .eq('id', inspectionId)
    .eq('company_id', companyId)
    .single()
  if (!inspection) return c.json({ error: 'Not found' }, 404)

  const levelsRaw = inspection.levels as LevelWithSpaces[] | undefined ?? []
  const allSpaces = levelsRaw.flatMap((l) => l.spaces ?? [])
  const targetSpace = spaceId ? allSpaces.find((s) => s.id === spaceId) ?? null : null
  if (spaceId && !targetSpace) {
    return c.json({ error: 'Space not found on this inspection' }, 404)
  }

  let workingLevels: LevelWithSpaces[] = levelsRaw.map((l) => ({
    ...l,
    spaces: sortedSpaces([...(l.spaces ?? [])]),
  }))

  const inspectionContext = {
    id: inspection.id,
    owner_name: inspection.owner_name,
    address: inspection.address,
    date: inspection.date,
    status: inspection.status,
    construction_year: inspection.construction_year,
    living_area: inspection.living_area,
    heating_type: inspection.heating_type,
    hot_water_system: inspection.hot_water_system,
    ventilation_type: inspection.ventilation_type,
    insulation_context: inspection.insulation_context,
    levels: workingLevels.map((lev) => ({
      id: lev.id,
      label: lev.label,
      fractional_index: lev.fractional_index,
      spaces: lev.spaces.map((sp) => ({
        id: sp.id,
        name: sp.name,
        fractional_index: sp.fractional_index,
        area: sp.area,
        window_count: sp.window_count,
        glazing_type: sp.glazing_type,
        heating_presence: sp.heating_presence,
        heating_type: sp.heating_type,
        ventilation_presence: sp.ventilation_presence,
        ventilation_type: sp.ventilation_type,
        insulation_rating: sp.insulation_rating,
      })),
    })),
  }

  const focusNote = targetSpace
    ? `Contexte écran : l'utilisateur édite l'espace id="${targetSpace.id}" (nom : "${targetSpace.name}"). Priorise les champs de cet espace pour les corrections ponctuelles.`
    : 'Contexte écran : vue inspection / niveaux (pas un détail de pièce).'

  let transcript: Awaited<ReturnType<typeof openai.audio.transcriptions.create>>
  try {
    transcript = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'fr',
    })
  } catch (e) {
    console.error('Whisper error', e)
    return c.json({ error: 'Speech transcription failed' }, 502)
  }

  const prompt = `Tu es un assistant pour les diagnostiqueurs immobiliers (DPE). À partir de la transcription vocale, extrais les actions structurées.

${focusNote}

Inspection et arborescence actuelles (JSON) :
${JSON.stringify(inspectionContext, null, 2)}

Champs modifiables sur l'inspection (id = "${inspectionId}") : ${INSPECTION_FIELDS.join(', ')}
Champs modifiables sur une pièce : ${SPACE_FIELDS.join(', ')}

IMPORTANT — ordre d'exécution côté serveur (tu dois structurer le JSON pour qu'il soit cohérent avec cet ordre) :
1) createLevels — nouveaux étages
2) createSpaces — nouvelles pièces (tu peux déjà inclure les détails dans chaque objet, voir ci-dessous)
3) changes — mises à jour sur l'inspection ou sur des pièces (existantes OU nouvelles via newSpaceIndex)

Créations :
- createLevels : [ { "label": "..." } ]
- createSpaces : chaque élément a "name", et soit "levelId" (uuid d'un niveau du JSON), soit "newLevelIndex" (0 = premier niveau créé dans createLevels de cette réponse).
  Tu PEUX inclure dans le même objet les champs optionnels de la pièce : ${SPACE_OPTIONAL_ON_CREATE.join(', ')} (ex. "window_count": 3, "heating_presence": true, "heating_type": "Radiateurs eau chaude").

Mises à jour (changes) :
- Pour l'inspection : { "table": "inspections", "id": "${inspectionId}", "field": "...", "value": ... }
- Pour une pièce DÉJÀ présente dans le JSON : { "table": "spaces", "id": "<uuid>", "field": "...", "value": ... }
- Pour une pièce CRÉÉE dans cette même réponse (pas encore d'uuid) : { "table": "spaces", "newSpaceIndex": N, "field": "...", "value": ... } où N est l'index 0-based dans l'ordre du tableau createSpaces (0 = première pièce créée, 1 = deuxième, etc.). Utilise ceci si tu décris d'abord les pièces puis leurs détails, ou si tu préfères séparer création et détails.

Transcription vocale : "${transcript.text}"

Réponds UNIQUEMENT avec un objet JSON de la forme :
{
  "createLevels": [ { "label": "..." } ],
  "createSpaces": [
    { "name": "...", "newLevelIndex": 0, "window_count": 2, "heating_presence": true }
  ],
  "changes": [
    { "table": "inspections", "id": "${inspectionId}", "field": "...", "value": ... },
    { "table": "spaces", "id": "<uuid existant>", "field": "...", "value": ... },
    { "table": "spaces", "newSpaceIndex": 0, "field": "window_count", "value": 3 }
  ]
}

Règles :
- N'invente pas d'uuid : pour les nouvelles lignes, utilise createLevels / createSpaces.
- Les valeurs de champs doivent correspondre aux types attendus (booléens pour heating_presence / ventilation_presence, nombres pour window_count et area, chaînes pour les types énumérés du contexte métier).
- Si une même information peut aller dans createSpaces OU dans changes avec newSpaceIndex, privilégie un seul endroit pour éviter les doublons.`

  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>
  try {
    completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
  } catch (e) {
    console.error('GPT error', e)
    return c.json({ error: 'Structured extraction failed' }, 502)
  }

  let parsed: ParsedVoice
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}') as ParsedVoice
  } catch {
    return c.json({ error: 'Invalid model output' }, 502)
  }

  const spaceIds = new Set(allSpaces.map((s) => s.id))
  const applied: Change[] = []
  const createdLevels: Tables<'levels'>[] = []
  const createdSpaces: Tables<'spaces'>[] = []
  const newLevelIdsInOrder: string[] = []
  /** Order of space ids created in this request — used to resolve newSpaceIndex in changes. */
  const createdSpaceIdsInOrder: string[] = []

  // ── 1) createLevels ─────────────────────────────────────────────
  for (const nl of parsed.createLevels ?? []) {
    const label = typeof nl.label === 'string' ? nl.label.trim() : ''
    if (!label) continue

    const fractional_index = keyAfterLevels(workingLevels)
    const { data, error } = await supabase
      .from('levels')
      .insert({
        inspection_id: inspectionId,
        label,
        fractional_index,
      })
      .select()
      .single()

    if (error) {
      console.error('Voice createLevels', error)
      return c.json({ error: 'Voice apply failed', detail: error.message }, 500)
    }
    if (!data) {
      return c.json({ error: 'Voice apply failed', detail: 'Level insert returned no row' }, 500)
    }

    createdLevels.push(data)
    newLevelIdsInOrder.push(data.id)
    workingLevels = [...workingLevels, { ...data, spaces: [] }]
  }

  const levelIdsInInspection = new Set(workingLevels.map((l) => l.id))

  // ── 2) createSpaces (optional inline details) ───────────────────
  for (const ns of parsed.createSpaces ?? []) {
    const name = typeof ns.name === 'string' ? ns.name.trim() : ''
    if (!name) continue

    let resolvedLevelId: string | undefined
    if (typeof ns.newLevelIndex === 'number' && Number.isInteger(ns.newLevelIndex)) {
      resolvedLevelId = newLevelIdsInOrder[ns.newLevelIndex]
    } else if (typeof ns.levelId === 'string' && levelIdsInInspection.has(ns.levelId)) {
      resolvedLevelId = ns.levelId
    }
    if (!resolvedLevelId) continue

    const levelNode = workingLevels.find((l) => l.id === resolvedLevelId)
    if (!levelNode) continue

    const fractional_index = keyAfterSpaces(levelNode.spaces)
    const insertRow = buildSpaceInsertRow(resolvedLevelId, name, fractional_index, ns)

    const { data, error } = await supabase.from('spaces').insert(insertRow).select().single()

    if (error) {
      console.error('Voice createSpaces', error)
      return c.json({ error: 'Voice apply failed', detail: error.message }, 500)
    }
    if (!data) {
      return c.json({ error: 'Voice apply failed', detail: 'Space insert returned no row' }, 500)
    }

    createdSpaces.push(data)
    createdSpaceIdsInOrder.push(data.id)
    spaceIds.add(data.id)
    levelNode.spaces = sortedSpaces([...levelNode.spaces, data])
  }

  // ── 3) changes (inspection + spaces by id or newSpaceIndex) ───
  for (const raw of parsed.changes ?? []) {
    if (raw.table !== 'inspections' && raw.table !== 'spaces') continue

    let targetId: string | undefined

    if (raw.table === 'inspections') {
      if (raw.id !== inspectionId) continue
      targetId = inspectionId
    } else {
      if (typeof raw.newSpaceIndex === 'number' && Number.isInteger(raw.newSpaceIndex)) {
        targetId = createdSpaceIdsInOrder[raw.newSpaceIndex]
      } else if (typeof raw.id === 'string' && spaceIds.has(raw.id)) {
        targetId = raw.id
      }
      if (!targetId) continue
    }

    const allowed: readonly string[] =
      raw.table === 'spaces' ? SPACE_FIELDS : INSPECTION_FIELDS
    if (!allowed.includes(raw.field as never)) continue

    const change: Change = {
      table: raw.table,
      id: targetId,
      field: raw.field,
      value: raw.value,
    }

    const { error: updateError } = await supabase
      .from(change.table)
      .update({ [change.field]: change.value } as never)
      .eq('id', change.id)

    if (updateError) {
      console.error('Voice changes', updateError)
      return c.json({ error: 'Voice apply failed', detail: updateError.message }, 500)
    }
    applied.push(change)
  }

  return c.json({
    changes: applied,
    createdLevels,
    createdSpaces,
  })
})
