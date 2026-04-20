import { Hono } from 'hono'
import type { TablesUpdate } from '../../../../database.types.js'
import { supabase } from '../lib/supabase.js'
import { pickAllowed } from '../lib/utils.js'
import { z } from 'zod'
import { SpacePostSchema } from '../lib/schemas.js'
import type { AppEnv } from '../types.js'

export const spacesRouter = new Hono<AppEnv>()

const PATCH_FIELDS = [
  'name', 'area', 'window_count', 'glazing_type', 'heating_presence',
  'heating_type', 'ventilation_presence', 'ventilation_type', 'insulation_rating',
  'fractional_index', 'level_id',
] as const satisfies readonly (keyof TablesUpdate<'spaces'>)[]

/** Returns the space row if it exists and belongs to companyId, otherwise null. */
async function fetchSpaceForCompany(spaceId: string, companyId: string) {
  const { data: space } = await supabase
    .from('spaces')
    .select('id, level_id')
    .eq('id', spaceId)
    .single()
  if (!space) return null

  const { data: level } = await supabase
    .from('levels')
    .select('inspection_id')
    .eq('id', space.level_id)
    .single()
  if (!level) return null

  const { data: inspection } = await supabase
    .from('inspections')
    .select('id')
    .eq('id', level.inspection_id)
    .eq('company_id', companyId)
    .single()

  return inspection ? space : null
}

spacesRouter.post('/', async (c) => {
  const { companyId } = c.get('auth')
  const raw = await c.req.json()
  const parsed = SpacePostSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400)
  const body = parsed.data

  const { data: level } = await supabase
    .from('levels')
    .select('inspection_id')
    .eq('id', body.levelId)
    .single()
  if (!level) return c.json({ error: 'Not found' }, 404)

  const { data: inspection } = await supabase
    .from('inspections')
    .select('id')
    .eq('id', level.inspection_id)
    .eq('company_id', companyId)
    .single()
  if (!inspection) return c.json({ error: 'Not found' }, 404)

  const { data, error } = await supabase
    .from('spaces')
    .insert({
      level_id: body.levelId,
      name: body.name,
      fractional_index: body.fractional_index,
      area: body.area ?? null,
      window_count: body.window_count ?? null,
      glazing_type: body.glazing_type ?? null,
      heating_presence: body.heating_presence ?? false,
      heating_type: body.heating_type ?? null,
      ventilation_presence: body.ventilation_presence ?? false,
      ventilation_type: body.ventilation_type ?? null,
      insulation_rating: body.insulation_rating ?? null,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

spacesRouter.patch('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()
  const body = await c.req.json<Record<string, unknown>>()

  if (!(await fetchSpaceForCompany(id, companyId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const update = pickAllowed<TablesUpdate<'spaces'>>(body, PATCH_FIELDS)
  const { data, error } = await supabase
    .from('spaces')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

spacesRouter.delete('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()

  if (!(await fetchSpaceForCompany(id, companyId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const { error } = await supabase.from('spaces').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return new Response(null, { status: 204 })
})
