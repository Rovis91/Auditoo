import { createClient } from '@supabase/supabase-js'
import { seedAuth } from './seed/auth.js'
import { seedCompanies, COMPANY_ID } from './seed/companies.js'
import { seedAgents } from './seed/agents.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('Seeding database...')
  const userId = await seedAuth()
  await seedCompanies(supabase)
  await seedAgents(supabase, { userId, companyId: COMPANY_ID })
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
