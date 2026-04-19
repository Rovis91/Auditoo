import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { supabase } from '../lib/supabase.js'
import type { AppEnv } from '../types.js'

/** Local Supabase often issues JWTs with 127.0.0.1 while .env uses localhost (or the reverse). */
function supabaseAuthIssuers(): string[] {
  const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const issuers = new Set<string>([`${base}/auth/v1`])
  try {
    const u = new URL(base)
    const portSuffix = u.port ? `:${u.port}` : ''
    if (u.hostname === 'localhost') {
      issuers.add(`http://127.0.0.1${portSuffix}/auth/v1`)
    }
    if (u.hostname === '127.0.0.1') {
      issuers.add(`http://localhost${portSuffix}/auth/v1`)
    }
  } catch {
    /* keep configured issuer only */
  }
  return [...issuers]
}

const JWKS = createRemoteJWKSet(
  new URL(`${(process.env.SUPABASE_URL ?? '').replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)
)

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice(7)
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: supabaseAuthIssuers(),
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
