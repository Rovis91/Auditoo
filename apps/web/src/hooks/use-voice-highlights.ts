import { useCallback, useMemo, useState } from 'react'
import type { VoiceChange } from '@/lib/api'
import {
  consumeField as consumeFieldStore,
  consumeLevelRow as consumeLevelRowStore,
  consumeSpaceRow as consumeSpaceRowStore,
  getFieldTone,
  getLevelRowTone,
  getSpaceChangeBadgeCount,
  getSpaceRowTone,
  voiceHighlightClass,
  type VoiceHighlightSurface,
  type VoiceHighlightTone,
} from '@/lib/voice-highlights'

/** Re-read session highlights and re-render after consume. */
export function useVoiceHighlights(inspectionId: string) {
  const [gen, setGen] = useState(0)
  const bump = useCallback(() => setGen((g) => g + 1), [])

  const fieldTone = useCallback(
    (table: VoiceChange['table'], entityId: string, field: string): VoiceHighlightTone | null => {
      void gen
      return getFieldTone(inspectionId, table, entityId, field)
    },
    [inspectionId, gen],
  )

  const spaceRowTone = useCallback(
    (spaceId: string): VoiceHighlightTone | null => {
      void gen
      return getSpaceRowTone(inspectionId, spaceId)
    },
    [inspectionId, gen],
  )

  const levelRowTone = useCallback(
    (levelId: string): VoiceHighlightTone | null => {
      void gen
      return getLevelRowTone(inspectionId, levelId)
    },
    [inspectionId, gen],
  )

  const spaceChangeBadgeCount = useCallback(
    (spaceId: string): number => {
      void gen
      return getSpaceChangeBadgeCount(inspectionId, spaceId)
    },
    [inspectionId, gen],
  )

  const ringClass = useCallback(
    (tone: VoiceHighlightTone | null | undefined, surface: VoiceHighlightSurface = 'control') =>
      voiceHighlightClass(tone ?? null, surface),
    [],
  )

  const consumeField = useCallback(
    (table: VoiceChange['table'], entityId: string, field: string) => {
      consumeFieldStore(inspectionId, table, entityId, field)
      bump()
    },
    [inspectionId, bump],
  )

  const consumeSpaceRow = useCallback(
    (spaceId: string) => {
      consumeSpaceRowStore(inspectionId, spaceId)
      bump()
    },
    [inspectionId, bump],
  )

  const consumeLevelRow = useCallback(
    (levelId: string) => {
      consumeLevelRowStore(inspectionId, levelId)
      bump()
    },
    [inspectionId, bump],
  )

  return useMemo(
    () => ({
      fieldTone,
      spaceRowTone,
      levelRowTone,
      spaceChangeBadgeCount,
      ringClass,
      consumeField,
      consumeSpaceRow,
      consumeLevelRow,
    }),
    [
      fieldTone,
      spaceRowTone,
      levelRowTone,
      spaceChangeBadgeCount,
      ringClass,
      consumeField,
      consumeSpaceRow,
      consumeLevelRow,
    ],
  )
}
