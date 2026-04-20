import { Hono } from 'hono'
import { z } from 'zod'
import { LoginSchema } from '../lib/schemas.js'
import { supabase } from '../lib/supabase.js'

export const authRouter = new Hono()

authRouter.post('/login', async (c) => {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400)
  const { email, password } = parsed.data
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  return c.json({ token: data.session.access_token })
})
