import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { inspectionsRouter } from './routes/inspections.js'
import { levelsRouter } from './routes/levels.js'
import { spacesRouter } from './routes/spaces.js'
import { voiceRouter } from './routes/voice.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.route('/auth', authRouter)

app.use('*', authMiddleware)

app.route('/inspections', inspectionsRouter)
app.route('/levels', levelsRouter)
app.route('/spaces', spacesRouter)
app.route('/voice', voiceRouter)

const port = Number(process.env.PORT) || 3001
serve({ fetch: app.fetch, port }, () => {
  console.log(`Auditoo API running on http://localhost:${port}`)
})
