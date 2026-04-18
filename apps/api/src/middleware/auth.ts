import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { supabase } from '../lib/supabase.js'
import type { AppEnv } from '../types.js'

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice(7)
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    })
    const userId = payload.sub
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const { data: agent } = await supabase
      .from('agents')
      .select('company_id')
      .eq('id', userId)
      .single()

    if (!agent) return c.json({ error: 'Unauthorized' }, 401)

    c.set('auth', { userId, companyId: agent.company_id })
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
