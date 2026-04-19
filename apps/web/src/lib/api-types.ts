export interface Inspection {
  id: string
  company_id: string
  agent_id: string
  owner_name: string | null
  address: string | null
  date: string | null
  status: string
  construction_year: number | null
  living_area: number | null
  heating_type: string | null
  hot_water_system: string | null
  ventilation_type: string | null
  insulation_context: string | null
  created_at: string
  updated_at: string
}

export interface Level {
  id: string
  inspection_id: string
  label: string
  fractional_index: string
  created_at: string
  updated_at: string
}

export interface Space {
  id: string
  level_id: string
  name: string
  area: number | null
  window_count: number | null
  glazing_type: string | null
  heating_presence: boolean
  heating_type: string | null
  ventilation_presence: boolean
  ventilation_type: string | null
  insulation_rating: string | null
  fractional_index: string
  created_at: string
  updated_at: string
}

export interface LevelWithSpaces extends Level {
  spaces: Space[]
}

export interface InspectionWithLevels extends Inspection {
  levels: LevelWithSpaces[]
}
