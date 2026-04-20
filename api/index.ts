import { handle } from 'hono/vercel'
import { app } from '../apps/api/src/app.js'

export const config = { runtime: 'edge' }
export default handle(app)
