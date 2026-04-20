import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { generateKeyBetween } from 'fractional-indexing'
import { ChevronLeft, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { EntityCard } from '@/components/entity-card'
import { SwipeDeleteRow } from '@/components/swipe-delete-row'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { OfflineBar } from '@/components/offline-bar'
import { VoiceBar } from '@/components/voice-bar'
import { useVoiceHighlights } from '@/hooks/use-voice-highlights'
import { api } from '@/lib/api'
import { VOICE_SYNCED_EVENT } from '@/lib/sync'
import type { InspectionWithLevels, Level, LevelWithSpaces, Space } from '@/lib/api-types'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function sorted<T extends { fractional_index: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.fractional_index < b.fractional_index ? -1 : 1)
}

function keyAfter(arr: { fractional_index: string }[]): string {
  const last = sorted(arr).at(-1)
  return generateKeyBetween(last?.fractional_index ?? null, null)
}

// ─────────────────────────────────────────────
// Sortable space row
// ─────────────────────────────────────────────

interface SpaceRowProps {
  space: Space
  onDelete: () => void
  voiceRowClassName?: string
  /** Count of "new" (green) voice-touched fields — badge next to the name */
  voiceChangeBadgeCount?: number
  onNavigateSpace: () => void
}

function SpaceRow({ space, onDelete, voiceRowClassName, voiceChangeBadgeCount = 0, onNavigateSpace }: SpaceRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: space.id, data: { type: 'space', levelId: space.level_id } })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <SwipeDeleteRow onDelete={onDelete}>
      <EntityCard
        ref={setNodeRef}
        style={style}
        data-testid="space-row"
        data-space-id={space.id}
        className={cn(
          'flex items-center gap-2 px-3 py-2 min-h-11 transition-[box-shadow,ring]',
          voiceRowClassName,
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'iconTouch' }),
            'text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 p-0',
          )}
          aria-label="Réordonner l'espace"
          data-testid="space-drag-handle"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <button
          type="button"
          className="flex-1 min-w-0 text-sm text-left text-card-foreground min-h-10 flex items-center gap-2"
          data-testid="space-name"
          onClick={onNavigateSpace}
        >
          <span className="min-w-0 flex-1 truncate">{space.name}</span>
          {voiceChangeBadgeCount > 0 ? (
            <span
              className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white tabular-nums shadow-sm"
              aria-label={`${voiceChangeBadgeCount} champs mis à jour par la voix`}
            >
              {voiceChangeBadgeCount > 99 ? '99+' : voiceChangeBadgeCount}
            </span>
          ) : null}
        </button>

        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground/40 shrink-0 pointer-events-none transition-transform duration-150 ease-out will-change-transform',
            'rotate-[calc(var(--swipe-openness,0)*180deg)]',
          )}
        />
      </EntityCard>
    </SwipeDeleteRow>
  )
}

// ─────────────────────────────────────────────
// Sortable level section
// ─────────────────────────────────────────────

interface LevelSectionProps {
  level: LevelWithSpaces
  onDeleteLevel: () => void
  onRenameLevel: (label: string) => void
  onDeleteSpace: (spaceId: string) => void
  onAddSpace: (levelId: string, name: string) => void
  voiceLevelClassName?: string
  voiceSpaceRowClassName: (spaceId: string) => string
  voiceSpaceChangeBadgeCount: (spaceId: string) => number
  onConsumeLevelRow: () => void
  onNavigateToSpace: (spaceId: string) => void
}

function LevelSection({
  level, onDeleteLevel, onRenameLevel,
  onDeleteSpace, onAddSpace,
  voiceLevelClassName,
  voiceSpaceRowClassName,
  voiceSpaceChangeBadgeCount,
  onConsumeLevelRow,
  onNavigateToSpace,
}: LevelSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: level.id, data: { type: 'level', levelId: level.id } })

  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(level.label)
  const [addingSpace, setAddingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const labelRef = useRef<HTMLInputElement>(null)
  const spaceInputRef = useRef<HTMLInputElement>(null)

  function startEditLabel(e: React.MouseEvent) {
    e.stopPropagation()
    onConsumeLevelRow()
    setEditingLabel(true)
    setTimeout(() => labelRef.current?.focus(), 0)
  }

  function commitLabel() {
    setEditingLabel(false)
    if (label.trim() && label !== level.label) onRenameLevel(label.trim())
    else setLabel(level.label)
  }

  function handleAddSpace() {
    setAddingSpace(true)
    setNewSpaceName('')
    setTimeout(() => spaceInputRef.current?.focus(), 0)
  }

  function commitAddSpace() {
    const name = newSpaceName.trim()
    if (name) onAddSpace(level.id, name)
    setAddingSpace(false)
    setNewSpaceName('')
  }

  const spaces = sorted(level.spaces)
  const spaceIds = spaces.map((s) => s.id)
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <EntityCard
      ref={setNodeRef}
      style={style}
      className="p-0 overflow-x-visible"
      data-testid="level-section"
      data-level-id={level.id}
    >
      {/* Level header */}
      <div
        className={cn(
          'flex items-center gap-1 sm:gap-2 px-2 py-2 border-b border-border bg-muted/25 min-h-10 rounded-t-lg transition-[box-shadow,ring]',
          voiceLevelClassName,
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'iconTouch' }),
            'text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 p-0',
          )}
          aria-label="Réordonner le niveau"
          data-testid="level-drag-handle"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {editingLabel ? (
          <input
            ref={labelRef}
            data-testid="level-label-input"
            className="flex-1 text-sm font-bold bg-transparent outline-none border-b border-primary min-h-10"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onFocus={onConsumeLevelRow}
            onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
          />
        ) : (
          <span className="flex-1 text-sm font-bold text-foreground min-h-10 flex items-center" data-testid="level-label">
            {level.label}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="iconTouch"
          onClick={startEditLabel}
          className="shrink-0 text-muted-foreground"
          aria-label="Renommer le niveau"
          data-testid="level-rename"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="iconTouch"
          onClick={handleAddSpace}
          className="shrink-0 text-muted-foreground"
          aria-label="Ajouter un espace"
          data-testid="level-add-space"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="iconTouch"
          onClick={onDeleteLevel}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Supprimer le niveau"
          data-testid="level-delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Spaces within level */}
      <SortableContext items={spaceIds} strategy={verticalListSortingStrategy}>
        <div className="p-2 space-y-2">
          {spaces.map((space) => (
            <SpaceRow
              key={space.id}
              space={space}
              onDelete={() => onDeleteSpace(space.id)}
              voiceRowClassName={voiceSpaceRowClassName(space.id)}
              voiceChangeBadgeCount={voiceSpaceChangeBadgeCount(space.id)}
              onNavigateSpace={() => onNavigateToSpace(space.id)}
            />
          ))}

          {addingSpace && (
            <div
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md bg-muted/10"
              data-testid="new-space-input-row"
            >
              <Input
                ref={spaceInputRef}
                data-testid="new-space-name-input"
                className="flex-1 min-h-10 text-sm border-0 shadow-none focus-visible:ring-0 p-0"
                placeholder="Nom de l'espace…"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onBlur={commitAddSpace}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAddSpace()
                  if (e.key === 'Escape') { setAddingSpace(false) }
                }}
              />
            </div>
          )}
        </div>
      </SortableContext>
    </EntityCard>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function InspectionDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const vh = useVoiceHighlights(id)
  const [inspection, setInspection] = useState<InspectionWithLevels | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .get<InspectionWithLevels>(`/inspections/${id}`)
      .then((data) => {
        setInspection(data)
        setLoadError(null)
      })
      .catch(() => setLoadError('Impossible de charger cette inspection hors ligne.'))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ inspectionId: string }>
      if (ce.detail?.inspectionId === id) void load()
    }
    window.addEventListener(VOICE_SYNCED_EVENT, handler)
    return () => window.removeEventListener(VOICE_SYNCED_EVENT, handler)
  }, [id, load])

  // ── Add level ──────────────────────────────
  const [addingLevel, setAddingLevel] = useState(false)
  const [newLevelLabel, setNewLevelLabel] = useState('')
  const levelInputRef = useRef<HTMLInputElement>(null)

  function handleAddLevel() {
    setAddingLevel(true)
    setNewLevelLabel('')
    setTimeout(() => levelInputRef.current?.focus(), 0)
  }

  async function commitAddLevel() {
    const label = newLevelLabel.trim()
    if (!label || !inspection) { setAddingLevel(false); return }
    const fractional_index = keyAfter(inspection.levels)
    const level = await api.post<Level>('/levels', { inspectionId: id, label, fractional_index })
    setInspection((prev) => prev ? {
      ...prev,
      levels: [...prev.levels, { ...level, spaces: [] }],
    } : prev)
    setAddingLevel(false)
    setNewLevelLabel('')
  }

  // ── Mutations ─────────────────────────────

  async function deleteLevel(levelId: string) {
    setInspection((prev) => prev ? {
      ...prev,
      levels: prev.levels.filter((l) => l.id !== levelId),
    } : prev)
    await api.delete(`/levels/${levelId}`)
  }

  async function renameLevel(levelId: string, label: string) {
    await api.patch(`/levels/${levelId}`, { label })
    setInspection((prev) => prev ? {
      ...prev,
      levels: prev.levels.map((l) => l.id === levelId ? { ...l, label } : l),
    } : prev)
  }

  async function addSpace(levelId: string, name: string) {
    if (!inspection) return
    const level = inspection.levels.find((l) => l.id === levelId)
    const fractional_index = keyAfter(level?.spaces ?? [])
    const space = await api.post<Space>('/spaces', { levelId, name, fractional_index })
    setInspection((prev) => prev ? {
      ...prev,
      levels: prev.levels.map((l) => l.id === levelId ? { ...l, spaces: [...l.spaces, space] } : l),
    } : prev)
  }

  async function deleteSpace(spaceId: string) {
    setInspection((prev) => prev ? {
      ...prev,
      levels: prev.levels.map((l) => ({
        ...l,
        spaces: l.spaces.filter((s) => s.id !== spaceId),
      })),
    } : prev)
    await api.delete(`/spaces/${spaceId}`)
  }

  // ── Drag and drop ─────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id || !inspection) return

    const activeData = active.data.current as { type: string; levelId?: string } | undefined
    const overData = over.data.current as { type: string; levelId?: string } | undefined

    if (activeData?.type === 'level' && overData?.type === 'level') {
      // Reorder levels
      const levels = sorted(inspection.levels)
      const oldIndex = levels.findIndex((l) => l.id === active.id)
      const newIndex = levels.findIndex((l) => l.id === over.id)
      const reordered = arrayMove(levels, oldIndex, newIndex)
      const before = reordered[newIndex - 1]?.fractional_index ?? null
      const after = reordered[newIndex + 1]?.fractional_index ?? null
      const fractional_index = generateKeyBetween(before, after)

      setInspection((prev) => prev ? {
        ...prev,
        levels: prev.levels.map((l) =>
          l.id === active.id ? { ...l, fractional_index } : l
        ),
      } : prev)
      api.patch(`/levels/${active.id}`, { fractional_index }).catch(load)
      return
    }

    if (activeData?.type === 'space') {
      const activeLevel = inspection.levels.find((l) => l.id === activeData.levelId)
      if (!activeLevel) return

      const targetLevelId =
        overData?.type === 'level'
          ? (over.id as string)
          : (overData?.levelId ?? activeData.levelId)
      const targetLevel = inspection.levels.find((l) => l.id === targetLevelId)
      if (!targetLevel) return

      const isCrossLevel = activeData.levelId !== targetLevelId

      if (isCrossLevel) {
        // Cross-level: move space to target level
        const fractional_index = keyAfter(targetLevel.spaces)
        setInspection((prev) => {
          if (!prev) return prev
          const space = prev.levels.flatMap((l) => l.spaces).find((s) => s.id === active.id)
          if (!space) return prev
          return {
            ...prev,
            levels: prev.levels.map((l) => {
              if (l.id === activeData.levelId) return { ...l, spaces: l.spaces.filter((s) => s.id !== active.id) }
              if (l.id === targetLevelId) return { ...l, spaces: [...l.spaces, { ...space, level_id: targetLevelId, fractional_index }] }
              return l
            }),
          }
        })
        api.patch(`/spaces/${active.id}`, { level_id: targetLevelId, fractional_index }).catch(load)
      } else {
        // Same level: reorder
        const spaces = sorted(activeLevel.spaces)
        const oldIndex = spaces.findIndex((s) => s.id === active.id)
        const newIndex = spaces.findIndex((s) => s.id === over.id)
        const reordered = arrayMove(spaces, oldIndex, newIndex)
        const before = reordered[newIndex - 1]?.fractional_index ?? null
        const after = reordered[newIndex + 1]?.fractional_index ?? null
        const fractional_index = generateKeyBetween(before, after)

        setInspection((prev) => prev ? {
          ...prev,
          levels: prev.levels.map((l) =>
            l.id === activeData.levelId
              ? { ...l, spaces: l.spaces.map((s) => s.id === active.id ? { ...s, fractional_index } : s) }
              : l
          ),
        } : prev)
        api.patch(`/spaces/${active.id}`, { fractional_index }).catch(load)
      }
    }
  }

  if (!inspection) {
    return (
      <div className="min-h-screen bg-background">
        <OfflineBar />
        {loadError ? (
          <div className="p-4 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: '/inspections' })}>
              Retour aux inspections
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
          </div>
        )}
      </div>
    )
  }

  const levels = sorted(inspection.levels)
  const levelIds = levels.map((l) => l.id)

  return (
    <div className="min-h-screen bg-background pb-20">
      <OfflineBar />

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="iconTouch"
          onClick={() => navigate({ to: '/inspections' })}
          className="shrink-0 text-muted-foreground"
          aria-label="Retour"
          data-testid="inspection-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">{inspection.owner_name || 'Sans nom'}</h1>
          <p className="text-xs text-muted-foreground truncate">{inspection.address || '—'}</p>
        </div>
        <Button
          size="iconTouch"
          variant="ghost"
          onClick={() => navigate({ to: '/inspections/$id/edit', params: { id } })}
          aria-label="Modifier l'inspection"
          data-testid="inspection-edit"
        >
          <Pencil className="w-5 h-5" />
        </Button>
      </header>

      <main className="p-4 space-y-3 max-w-2xl mx-auto w-full" data-testid="levels-spaces-main">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={levelIds} strategy={verticalListSortingStrategy}>
            {levels.map((level) => (
              <LevelSection
                key={level.id}
                level={level}
                onDeleteLevel={() => deleteLevel(level.id)}
                onRenameLevel={(label) => renameLevel(level.id, label)}
                onDeleteSpace={deleteSpace}
                onAddSpace={addSpace}
                voiceLevelClassName={vh.ringClass(vh.levelRowTone(level.id), 'cardTop')}
                voiceSpaceRowClassName={(sid) => vh.ringClass(vh.spaceRowTone(sid), 'card')}
                voiceSpaceChangeBadgeCount={(sid) => {
                  const t = vh.spaceRowTone(sid)
                  return t === 'new' ? vh.spaceChangeBadgeCount(sid) : 0
                }}
                onConsumeLevelRow={() => vh.consumeLevelRow(level.id)}
                onNavigateToSpace={(spaceId) =>
                  navigate({ to: '/inspections/$id/spaces/$spaceId', params: { id, spaceId } })}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeId && (
              <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl opacity-95 text-sm font-medium">
                En déplacement…
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Add level */}
        {addingLevel ? (
          <div className="flex items-center gap-2 px-2 py-1.5 border border-dashed border-border rounded-md" data-testid="new-level-input-row">
            <Input
              ref={levelInputRef}
              data-testid="new-level-name-input"
              className="flex-1 min-h-10 text-sm border-0 shadow-none focus-visible:ring-0 p-0 font-semibold"
              placeholder="Nom du niveau…"
              value={newLevelLabel}
              onChange={(e) => setNewLevelLabel(e.target.value)}
              onBlur={commitAddLevel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAddLevel()
                if (e.key === 'Escape') setAddingLevel(false)
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAddLevel}
            data-testid="add-level"
            className="w-full flex items-center justify-center gap-2 min-h-11 px-3 py-2.5 border border-dashed border-primary/30 rounded-lg text-sm text-primary/60 hover:text-primary hover:border-primary/50 transition-colors"
          >
            <Plus className="w-5 h-5 shrink-0" />
            Ajouter un niveau
          </button>
        )}
      </main>

      <VoiceBar inspectionId={id} onComplete={(r) => { if (r.status === 'applied') void load() }} />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/inspections/$id/')({
  component: InspectionDetailPage,
})
