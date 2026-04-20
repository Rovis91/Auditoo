import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { inspectionsRouter } from './routes/inspections.js'
import { levelsRouter } from './routes/levels.js'
import { spacesRouter } from './routes/spaces.js'
import { voiceRouter } from './routes/voice.js'

/** Comma-separated `CORS_ORIGINS` merged with local Vite defaults so production CORS does not break `npm run dev`. */
function corsAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim()
  const extra = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const local = ['http://localhost:5173', 'http://127.0.0.1:5173']
  return [...new Set([...local, ...extra])]
}

function buildRoutes(app: Hono) {
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
}

/**
 * On Vercel, serverless routes live under `/api/*`. Locally the API is served at the root
 * (e.g. `http://localhost:3001/auth`).
 */
export const app = process.env.VERCEL
  ? (() => {
      const h = new Hono().basePath('/api')
      buildRoutes(h)
      return h
    })()
  : (() => {
      const h = new Hono()
      buildRoutes(h)
      return h
    })()
