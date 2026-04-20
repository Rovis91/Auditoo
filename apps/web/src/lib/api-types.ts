// Re-export from the repo-root source of truth so all imports of this module
// stay in sync with the generated Supabase schema via database.extended.types.ts.
export type {
  Inspection,
  Level,
  Space,
  Company,
  Agent,
  LevelWithSpaces,
  InspectionWithLevels,
} from '../../../../database.extended.types'
