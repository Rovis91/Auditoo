import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'

export const authRouter = new Hono()

authRouter.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  return c.json({ token: data.session.access_token })
})
