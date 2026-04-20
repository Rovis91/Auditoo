import type { Database } from './database.types'

// Row types derived from the generated Supabase schema — single source of truth.
// Re-run `npm run db:types` whenever the schema changes to keep database.types.ts current,
// then these aliases pick up the changes automatically.
export type Inspection = Database['public']['Tables']['inspections']['Row']
export type Level      = Database['public']['Tables']['levels']['Row']
export type Space      = Database['public']['Tables']['spaces']['Row']
export type Company    = Database['public']['Tables']['companies']['Row']
export type Agent      = Database['public']['Tables']['agents']['Row']

// Composed shapes returned by the API's nested-select endpoints.
export type LevelWithSpaces      = Level & { spaces: Space[] }
export type InspectionWithLevels = Inspection & { levels: LevelWithSpaces[] }
