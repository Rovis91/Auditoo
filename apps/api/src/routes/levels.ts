import { Hono } from 'hono'
import type { TablesInsert, TablesUpdate } from '../../../../database.types.js'
import { supabase } from '../lib/supabase.js'
import { pickAllowed } from '../lib/utils.js'
import type { AppEnv } from '../types.js'

export const levelsRouter = new Hono<AppEnv>()

const PATCH_FIELDS = ['label', 'fractional_index'] as const satisfies
  readonly (keyof TablesUpdate<'levels'>)[]

/** Returns the level row if it exists and belongs to companyId, otherwise null. */
async function fetchLevelForCompany(levelId: string, companyId: string) {
  const { data: level } = await supabase
    .from('levels')
    .select('id, inspection_id')
    .eq('id', levelId)
    .single()
  if (!level) return null

  const { data: inspection } = await supabase
    .from('inspections')
    .select('id')
    .eq('id', level.inspection_id)
    .eq('company_id', companyId)
    .single()

  return inspection ? level : null
}

levelsRouter.post('/', async (c) => {
  const { companyId } = c.get('auth')
  const body = await c.req.json<TablesInsert<'levels'> & { inspectionId: string }>()

  const { data: inspection } = await supabase
    .from('inspections')
    .select('id')
    .eq('id', body.inspectionId)
    .eq('company_id', companyId)
    .single()
  if (!inspection) return c.json({ error: 'Not found' }, 404)

  const { data, error } = await supabase
    .from('levels')
    .insert({
      inspection_id: body.inspectionId,
      label: body.label,
      fractional_index: body.fractional_index,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

levelsRouter.patch('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()
  const body = await c.req.json<Record<string, unknown>>()

  if (!(await fetchLevelForCompany(id, companyId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const update = pickAllowed<TablesUpdate<'levels'>>(body, PATCH_FIELDS)
  const { data, error } = await supabase
    .from('levels')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

levelsRouter.delete('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const { id } = c.req.param()

  if (!(await fetchLevelForCompany(id, companyId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const { error } = await supabase.from('levels').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return new Response(null, { status: 204 })
})
