import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { inspectionsRouter } from './routes/inspections.js'
import { levelsRouter } from './routes/levels.js'
import { spacesRouter } from './routes/spaces.js'
import { voiceRouter } from './routes/voice.js'

/** Comma-separated `CORS_ORIGINS`, or local Vite defaults for development. */
function corsAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim()
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}

const app = new Hono()

app.use(
  '*',
  cors({
    origin: corsAllowedOrigins(),
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.route('/auth', authRouter)

/** Public liveness check for the sync manager ping (no JWT — see apps/web/src/lib/sync.ts). */
app.get('/health', (c) => c.json({ ok: true }))

app.use('*', authMiddleware)

app.route('/inspections', inspectionsRouter)
app.route('/levels', levelsRouter)
app.route('/spaces', spacesRouter)
app.route('/voice', voiceRouter)

const port = Number(process.env.PORT) || 3001
serve({ fetch: app.fetch, port }, () => {
  console.log(`Auditoo API running on http://localhost:${port}`)
})
