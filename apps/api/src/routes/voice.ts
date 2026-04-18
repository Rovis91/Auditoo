import { Hono } from 'hono'
import OpenAI from 'openai'
import type { Tables } from '../../../../database.types.js'
import { supabase } from '../lib/supabase.js'
import type { AppEnv } from '../types.js'

export const voiceRouter = new Hono<AppEnv>()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const INSPECTION_FIELDS: readonly (keyof Tables<'inspections'>)[] = [
  'owner_name', 'address', 'date', 'status', 'construction_year',
  'living_area', 'heating_type', 'hot_water_system', 'ventilation_type', 'insulation_context',
]
const SPACE_FIELDS: readonly (keyof Tables<'spaces'>)[] = [
  'name', 'area', 'window_count', 'glazing_type', 'heating_presence',
  'heating_type', 'ventilation_presence', 'ventilation_type', 'insulation_rating',
]

type Change = {
  table: 'inspections' | 'spaces'
  id: string
  field: string
  value: unknown
}

voiceRouter.post('/', async (c) => {
  const { companyId } = c.get('auth')

  const formData = await c.req.formData()
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

  const transcript = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: audioFile,
    language: 'fr',
  })

  // levels and spaces are inferred by the typed client as nested arrays
  type Level = Tables<'levels'> & { spaces: Tables<'spaces'>[] }
  const levels = inspection.levels as Level[] | undefined ?? []
  const allSpaces = levels.flatMap((l) => l.spaces)
  const targetSpace = spaceId ? allSpaces.find((s) => s.id === spaceId) ?? null : null
  const context = targetSpace ?? inspection
  const allowedFields = targetSpace ? SPACE_FIELDS : INSPECTION_FIELDS
  const targetTable: 'inspections' | 'spaces' = targetSpace ? 'spaces' : 'inspections'
  const targetId = targetSpace?.id ?? inspectionId

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant pour les diagnostiqueurs immobiliers. À partir de la transcription vocale, extrais les mises à jour de champs structurés.

Contexte actuel (JSON) :
${JSON.stringify(context, null, 2)}

Champs autorisés : ${allowedFields.join(', ')}

Transcription vocale : "${transcript.text}"

Réponds UNIQUEMENT avec un objet JSON dans ce format exact :
{
  "changes": [
    { "table": "${targetTable}", "id": "${targetId}", "field": "<nom_du_champ>", "value": <nouvelle_valeur> }
  ]
}

N'inclure que les champs explicitement mentionnés. Utiliser null pour les valeurs effacées.`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(completion.choices[0].message.content ?? '{}') as {
    changes: Change[]
  }
  const applied: Change[] = []

  for (const change of parsed.changes ?? []) {
    const allowed: readonly string[] =
      change.table === 'spaces' ? SPACE_FIELDS : INSPECTION_FIELDS
    if (!allowed.includes(change.field)) continue

    // field name is validated against allowed lists above; cast bypasses
    // RejectExcessProperties which blocks index-signature objects at compile time
    const { error } = await supabase
      .from(change.table)
      .update({ [change.field]: change.value } as never)
      .eq('id', change.id)

    if (!error) applied.push(change)
  }

  return c.json({ changes: applied })
})
