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
import { useDrag } from '@use-gesture/react'
import { generateKeyBetween } from 'fractional-indexing'
import { ChevronLeft, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OfflineBar } from '@/components/offline-bar'
import { VoiceBar } from '@/components/voice-bar'
import { api } from '@/lib/api'
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
// Swipeable row (for spaces)
// ─────────────────────────────────────────────

interface SwipeRowProps {
  onDelete: () => void
  children: React.ReactNode
}

function SwipeRow({ onDelete, children }: SwipeRowProps) {
  const [dx, setDx] = useState(0)
  const THRESHOLD = -72

  const bind = useDrag(
    ({ movement: [mx], last, cancel }) => {
      if (mx > 0) { cancel(); return }
      setDx(last ? (mx < THRESHOLD ? THRESHOLD : 0) : Math.max(mx, THRESHOLD))
    },
    { axis: 'x', filterTaps: true }
  )

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 flex items-center px-3 bg-destructive rounded-lg">
        <button
          onClick={onDelete}
          className="text-destructive-foreground"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div
        {...bind()}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        className="relative bg-card transition-transform duration-150"
      >
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sortable space row
// ─────────────────────────────────────────────

interface SpaceRowProps {
  space: Space
  inspectionId: string
  onDelete: () => void
  onRename: (name: string) => void
}

function SpaceRow({ space, inspectionId, onDelete, onRename }: SpaceRowProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: space.id, data: { type: 'space', levelId: space.level_id } })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(space.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitRename() {
    setEditing(false)
    if (name.trim() && name !== space.name) onRename(name.trim())
    else setName(space.name)
  }

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <SwipeRow onDelete={onDelete}>
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg bg-card">
        <button {...attributes} {...listeners} className="text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="w-4 h-4" />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            className="flex-1 text-sm bg-transparent outline-none border-b border-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          />
        ) : (
          <button
            className="flex-1 text-sm text-left text-card-foreground"
            onClick={() => navigate({ to: '/inspections/$id/spaces/$spaceId', params: { id: inspectionId, spaceId: space.id } })}
          >
            {space.name}
          </button>
        )}

        <button onClick={startEdit} className="text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </SwipeRow>
  )
}

// ─────────────────────────────────────────────
// Sortable level section
// ─────────────────────────────────────────────

interface LevelSectionProps {
  level: LevelWithSpaces
  inspectionId: string
  onDeleteLevel: () => void
  onRenameLevel: (label: string) => void
  onDeleteSpace: (spaceId: string) => void
  onRenameSpace: (spaceId: string, name: string) => void
  onAddSpace: (levelId: string, name: string) => void
}

function LevelSection({
  level, inspectionId, onDeleteLevel, onRenameLevel,
  onDeleteSpace, onRenameSpace, onAddSpace,
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
    <div ref={setNodeRef} style={style} className="space-y-1.5">
      {/* Level header */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/60">
        <button {...attributes} {...listeners} className="text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="w-4 h-4" />
        </button>

        {editingLabel ? (
          <input
            ref={labelRef}
            className="flex-1 text-sm font-semibold bg-transparent outline-none border-b border-primary"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-foreground">{level.label}</span>
        )}

        <button onClick={startEditLabel} className="text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleAddSpace} className="text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={onDeleteLevel} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Spaces within level */}
      <SortableContext items={spaceIds} strategy={verticalListSortingStrategy}>
        <div className="pl-4 space-y-1.5">
          {spaces.map((space) => (
            <SpaceRow
              key={space.id}
              space={space}
              inspectionId={inspectionId}
              onDelete={() => onDeleteSpace(space.id)}
              onRename={(name) => onRenameSpace(space.id, name)}
            />
          ))}

          {addingSpace && (
            <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg">
              <Input
                ref={spaceInputRef}
                className="flex-1 h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0"
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
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function InspectionDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
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

  async function renameSpace(spaceId: string, name: string) {
    await api.patch(`/spaces/${spaceId}`, { name })
    setInspection((prev) => prev ? {
      ...prev,
      levels: prev.levels.map((l) => ({
        ...l,
        spaces: l.spaces.map((s) => s.id === spaceId ? { ...s, name } : s),
      })),
    } : prev)
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

      <header className="sticky top-7 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: '/inspections' })}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{inspection.owner_name || 'Sans nom'}</h1>
          <p className="text-xs text-muted-foreground truncate">{inspection.address || '—'}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate({ to: '/inspections/$id/edit', params: { id } })}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </header>

      <main className="p-4 space-y-3">
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
                inspectionId={id}
                onDeleteLevel={() => deleteLevel(level.id)}
                onRenameLevel={(label) => renameLevel(level.id, label)}
                onDeleteSpace={deleteSpace}
                onRenameSpace={renameSpace}
                onAddSpace={addSpace}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeId && (
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg opacity-90 text-sm">
                En déplacement…
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Add level */}
        {addingLevel ? (
          <div className="flex items-center gap-2 px-2 py-1.5 border border-dashed border-border rounded-md">
            <Input
              ref={levelInputRef}
              className="flex-1 h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0 font-semibold"
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
            onClick={handleAddLevel}
            className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un niveau
          </button>
        )}
      </main>

      <VoiceBar />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/inspections/$id/')({
  component: InspectionDetailPage,
})
