import { z } from 'zod'
import { INSPECTION_VOICE_FIELDS, SPACE_VOICE_FIELDS } from './voice-constants.js'

const inspectionFieldSet = new Set<string>(INSPECTION_VOICE_FIELDS)
const spaceFieldSet = new Set<string>(SPACE_VOICE_FIELDS)

/** Scalar JSON values only — rejects objects/arrays from the model. */
const voiceJsonScalar = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const VoiceRawChangeSchema = z
  .object({
    table: z.enum(['inspections', 'spaces']),
    id: z.string().uuid().optional(),
    newSpaceIndex: z.number().int().min(0).optional(),
    field: z.string().min(1).max(120),
    value: voiceJsonScalar,
  })
  .superRefine((data, ctx) => {
    if (data.table === 'inspections') {
      if (!data.id) {
        ctx.addIssue({ code: 'custom', message: 'inspections changes require id', path: ['id'] })
      }
      if (!inspectionFieldSet.has(data.field)) {
        ctx.addIssue({ code: 'custom', message: 'invalid field for inspections', path: ['field'] })
      }
    } else {
      if (data.id == null && data.newSpaceIndex === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'spaces changes require id or newSpaceIndex',
          path: ['id'],
        })
      }
      if (!spaceFieldSet.has(data.field)) {
        ctx.addIssue({ code: 'custom', message: 'invalid field for spaces', path: ['field'] })
      }
    }
  })

const voiceSpaceCreateOptional = z.object({
  area: z.number().nullable().optional(),
  window_count: z.number().int().min(0).nullable().optional(),
  glazing_type: z.string().nullable().optional(),
  heating_presence: z.boolean().optional(),
  heating_type: z.string().nullable().optional(),
  ventilation_presence: z.boolean().optional(),
  ventilation_type: z.string().nullable().optional(),
  insulation_rating: z.string().nullable().optional(),
})

export const VoiceCreateSpaceSchema = z
  .object({
    name: z.string().min(1).max(500),
    levelId: z.string().uuid().optional(),
    newLevelIndex: z.number().int().min(0).optional(),
  })
  .and(voiceSpaceCreateOptional)
  .superRefine((data, ctx) => {
    if (data.levelId == null && data.newLevelIndex === undefined) {
      ctx.addIssue({ code: 'custom', message: 'createSpaces requires levelId or newLevelIndex', path: [] })
    }
  })

export const VoiceParsedSchema = z
  .object({
    createLevels: z.array(z.object({ label: z.string().max(500) })).max(50).nullish(),
    createSpaces: z.array(VoiceCreateSpaceSchema).max(100).nullish(),
    changes: z.array(VoiceRawChangeSchema).max(200).nullish(),
  })
  .strict()

export type VoiceParsed = z.infer<typeof VoiceParsedSchema>
export type VoiceCreateSpaceInput = z.infer<typeof VoiceCreateSpaceSchema>
