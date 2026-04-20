import { Hono } from 'hono'
import type { TablesUpdate } from '../../../../database.types.js'
import { supabase } from '../lib/supabase.js'
import { pickAllowed } from '../lib/utils.js'
import { z } from 'zod'
import { InspectionPostSchema } from '../lib/schemas.js'
import type { AppEnv } from '../types.js'

export const inspectionsRouter = new Hono<AppEnv>()

const PATCH_FIELDS = [
  'owner_name', 'address', 'date', 'status', 'construction_year',
  'living_area', 'heating_type', 'hot_water_system', 'ventilation_type', 'insulation_context',
] as const satisfies readonly (keyof TablesUpdate<'inspections'>)[]

inspectionsRouter.get('/', async (c) => {
  const { companyId } = c.get('auth')
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

inspectionsRouter.post('/', async (c) => {
  const { userId, companyId } = c.get('auth')
  const raw = await c.req.json()
  const parsed = InspectionPostSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400)
  const body = parsed.data
  const { data, error } = await supabase
    .from('inspections')
    .insert({
      company_id: companyId,
      agent_id: userId,
      owner_name: body.owner_name ?? null,
      address: body.address ?? null,
      date: body.date ?? null,
      status: body.status ?? 'draft',
      construction_year: body.construction_year ?? null,
      living_area: body.living_area ?? null,
      heating_type: body.heating_type ?? null,
      hot_water_system: body.hot_water_system ?? null,
      ventilation_type: body.ventilation_type ?? null,
      insulation_context: body.insulation_context ?? null,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

inspectionsRouter.get('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()
  const { data, error } = await supabase
    .from('inspections')
    .select('*, levels(*, spaces(*))')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()
  if (error || !data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

inspectionsRouter.patch('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()
  const body = await c.req.json<Record<string, unknown>>()
  const update = pickAllowed<TablesUpdate<'inspections'>>(body, PATCH_FIELDS)
  const { data, error } = await supabase
    .from('inspections')
    .update(update)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()
  if (error || !data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

inspectionsRouter.delete('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()
  const { error } = await supabase
    .from('inspections')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
  if (error) return c.json({ error: error.message }, 500)
  return new Response(null, { status: 204 })
})
