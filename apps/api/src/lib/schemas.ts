import { z } from 'zod'

export const InspectionPostSchema = z.object({
  owner_name: z.string().nullish(),
  address: z.string().nullish(),
  date: z.iso.date().nullish(),
  status: z.enum(['draft', 'completed']).optional(),
  construction_year: z.number().int().min(1000).max(2100).nullish(),
  living_area: z.number().positive().nullish(),
  heating_type: z.string().nullish(),
  hot_water_system: z.string().nullish(),
  ventilation_type: z.string().nullish(),
  insulation_context: z.string().nullish(),
})

export const LevelPostSchema = z.object({
  inspectionId: z.uuid(),
  label: z.string().min(1),
  fractional_index: z.string().min(1),
})

export const SpacePostSchema = z.object({
  levelId: z.uuid(),
  name: z.string().min(1),
  fractional_index: z.string().min(1),
  area: z.number().positive().nullish(),
  window_count: z.number().int().min(0).nullish(),
  glazing_type: z.string().nullish(),
  heating_presence: z.boolean().optional(),
  heating_type: z.string().nullish(),
  ventilation_presence: z.boolean().optional(),
  ventilation_type: z.string().nullish(),
  insulation_rating: z.string().nullish(),
})
