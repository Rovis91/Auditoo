/** Allowed inspection columns for voice `changes` — keep in sync with DB and `voice-schemas`. */
export const INSPECTION_VOICE_FIELDS = [
  'owner_name',
  'address',
  'date',
  'status',
  'construction_year',
  'living_area',
  'heating_type',
  'hot_water_system',
  'ventilation_type',
  'insulation_context',
] as const

/** Allowed space columns for voice `changes` — keep in sync with DB and `voice-schemas`. */
export const SPACE_VOICE_FIELDS = [
  'name',
  'area',
  'window_count',
  'glazing_type',
  'heating_presence',
  'heating_type',
  'ventilation_presence',
  'ventilation_type',
  'insulation_rating',
] as const
