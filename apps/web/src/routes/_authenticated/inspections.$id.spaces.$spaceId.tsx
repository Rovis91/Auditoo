import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppWindow,
  ChevronLeft,
  Flame,
  Home,
  Layers,
  Square,
  Thermometer,
  Wind,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { VoiceBar } from '@/components/voice-bar'
import { useVoiceHighlights } from '@/hooks/use-voice-highlights'
import { api } from '@/lib/api'
import type { InspectionWithLevels, Space } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { consumeLevelRow, consumeSpaceRow } from '@/lib/voice-highlights'
import { VOICE_SYNCED_EVENT } from '@/lib/sync'

const GLAZING_TYPES = ['Simple vitrage', 'Double vitrage', 'Triple vitrage']
const HEATING_TYPES = [
  'Radiateurs électriques', 'Plancher chauffant', 'Radiateurs eau chaude',
  'Convecteurs', 'Pompe à chaleur', 'Poêle', 'Autre',
]
const VENTILATION_TYPES = ['VMC simple flux', 'VMC double flux', 'Ventilation naturelle', 'Insufflation', 'Autre']
const INSULATION_RATINGS = ['Très bonne', 'Bonne', 'Moyenne', 'Mauvaise', 'Très mauvaise']

function scrollFieldIntoView(e: React.FocusEvent<HTMLElement>) {
  requestAnimationFrame(() => {
    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function FieldIcon({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      {children}
    </div>
  )
}

function SpaceDetailPage() {
  const { id, spaceId } = Route.useParams()
  const navigate = useNavigate()
  const vh = useVoiceHighlights(id)
  const [space, setSpace] = useState<Space | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const levelIdRef = useRef<string | undefined>(undefined)

  const loadSpace = useCallback(() => {
    api.get<InspectionWithLevels>(`/inspections/${id}`).then((insp) => {
      const found = insp.levels.flatMap((l) => l.spaces).find((s) => s.id === spaceId)
      if (found) setSpace(found)
    })
  }, [id, spaceId])

  useEffect(() => {
    loadSpace()
  }, [loadSpace])

  useEffect(() => {
    if (space?.level_id) levelIdRef.current = space.level_id
  }, [space?.level_id])

  useEffect(() => {
    return () => {
      consumeSpaceRow(id, spaceId)
      const lid = levelIdRef.current
      if (lid) consumeLevelRow(id, lid)
    }
  }, [id, spaceId])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ inspectionId: string }>
      if (ce.detail?.inspectionId === id) void loadSpace()
    }
    window.addEventListener(VOICE_SYNCED_EVENT, handler)
    return () => window.removeEventListener(VOICE_SYNCED_EVENT, handler)
  }, [id, loadSpace])

  function autosave(field: keyof Space, value: unknown) {
    clearTimeout(saveTimers.current[field])
    saveTimers.current[field] = setTimeout(() => {
      api.patch(`/spaces/${spaceId}`, { [field]: value })
    }, 300)
  }

  function handleChange<K extends keyof Space>(field: K, value: Space[K]) {
    setSpace((prev) => prev ? { ...prev, [field]: value } : prev)
    autosave(field, value)
  }

  if (!space) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-48 h-4 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="iconTouch"
          onClick={() => navigate({ to: '/inspections/$id', params: { id } })}
          className="shrink-0 text-muted-foreground"
          aria-label="Retour"
          data-testid="space-detail-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" data-testid="space-detail-title">
          {space.name}
        </h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 overflow-y-auto p-4 scroll-pb-28">
        <div className="space-y-2">
          <Label htmlFor="name">Nom</Label>
          <FieldIcon icon={Home}>
            <Input
              id="name"
              data-testid="space-detail-name"
              value={space.name}
              className={cn('pl-9', vh.ringClass(vh.fieldTone('spaces', spaceId, 'name')))}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={(e) => autosave('name', e.target.value)}
              onFocus={(e) => {
                vh.consumeField('spaces', spaceId, 'name')
                scrollFieldIntoView(e)
              }}
            />
          </FieldIcon>
        </div>


        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="area">Surface (m²)</Label>
            <FieldIcon icon={Square}>
              <Input
                id="area"
                data-testid="space-detail-area"
                type="number"
                min={0}
                step={0.1}
                value={space.area ?? ''}
                className={cn(
                  'pl-9 tabular-nums',
                  vh.ringClass(vh.fieldTone('spaces', spaceId, 'area')),
                )}
                onChange={(e) => handleChange('area', e.target.value ? Number(e.target.value) : null)}
                onFocus={(e) => {
                  vh.consumeField('spaces', spaceId, 'area')
                  scrollFieldIntoView(e)
                }}
              />
            </FieldIcon>
          </div>

          <div className="space-y-2">
            <Label htmlFor="window_count">Nb. fenêtres</Label>
            <FieldIcon icon={AppWindow}>
              <Input
                id="window_count"
                data-testid="space-detail-window-count"
                type="number"
                min={0}
                value={space.window_count ?? ''}
                className={cn(
                  'pl-9 tabular-nums',
                  vh.ringClass(vh.fieldTone('spaces', spaceId, 'window_count')),
                )}
                onChange={(e) =>
                  handleChange('window_count', e.target.value ? Number(e.target.value) : null)
                }
                onFocus={(e) => {
                  vh.consumeField('spaces', spaceId, 'window_count')
                  scrollFieldIntoView(e)
                }}
              />
            </FieldIcon>
          </div>
        </div>
        <Select value={space.glazing_type ?? ''} onValueChange={(v) => handleChange('glazing_type', v || null)}>
          <FieldIcon icon={Layers}>
            <SelectTrigger
              data-testid="space-detail-glazing"
              className={cn(
                'bg-muted/50 pl-9',
                vh.ringClass(vh.fieldTone('spaces', spaceId, 'glazing_type')),
              )}
              onPointerDown={() => vh.consumeField('spaces', spaceId, 'glazing_type')}
            >
              <SelectValue placeholder="—" />
            </SelectTrigger>
          </FieldIcon>
          <SelectContent>
            {GLAZING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={space.insulation_rating ?? ''}
          onValueChange={(v) => handleChange('insulation_rating', v || null)}
        >
          <FieldIcon icon={Thermometer}>
            <SelectTrigger
              data-testid="space-detail-insulation"
              className={cn(
                'bg-muted/50 pl-9',
                vh.ringClass(vh.fieldTone('spaces', spaceId, 'insulation_rating')),
              )}
              onPointerDown={() => vh.consumeField('spaces', spaceId, 'insulation_rating')}
            >
              <SelectValue placeholder="—" />
            </SelectTrigger>
          </FieldIcon>
          <SelectContent>
            {INSULATION_RATINGS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div
          className={cn(
            'space-y-3 rounded-lg border border-border p-3',
            vh.ringClass(vh.fieldTone('spaces', spaceId, 'heating_presence'), 'card'),
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="heating_presence" className="flex items-center gap-2 font-normal">
              <Flame className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Chauffage
            </Label>
            <Switch
              id="heating_presence"
              data-testid="space-detail-heating-presence"
              checked={space.heating_presence}
              onCheckedChange={(v) => handleChange('heating_presence', v)}
              onPointerDown={() => vh.consumeField('spaces', spaceId, 'heating_presence')}
            />
          </div>

          
          {space.heating_presence && (
            <Select value={space.heating_type ?? ''} onValueChange={(v) => handleChange('heating_type', v || null)}>
              <SelectTrigger
                data-testid="space-detail-heating-type"
                className={cn(
                  'bg-muted/50 ',
                  vh.ringClass(vh.fieldTone('spaces', spaceId, 'heating_type')),
                )}
                onPointerDown={() => vh.consumeField('spaces', spaceId, 'heating_type')}
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {HEATING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div
          className={cn(
            'space-y-3 rounded-lg border border-border p-3',
            vh.ringClass(vh.fieldTone('spaces', spaceId, 'ventilation_presence'), 'card'),
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ventilation_presence" className="flex items-center gap-2 font-normal">
              <Wind className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Ventilation
            </Label>
            <Switch
              id="ventilation_presence"
              data-testid="space-detail-ventilation-presence"
              checked={space.ventilation_presence}
              onCheckedChange={(v) => handleChange('ventilation_presence', v)}
              onPointerDown={() => vh.consumeField('spaces', spaceId, 'ventilation_presence')}
            />
          </div>
          {space.ventilation_presence && (
            <Select
              value={space.ventilation_type ?? ''}
              onValueChange={(v) => handleChange('ventilation_type', v || null)}
            >
              <SelectTrigger
                data-testid="space-detail-ventilation-type"
                className={cn(
                  'bg-muted/50 pl-9',
                  vh.ringClass(vh.fieldTone('spaces', spaceId, 'ventilation_type')),
                )}
                onPointerDown={() => vh.consumeField('spaces', spaceId, 'ventilation_type')}
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {VENTILATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </main>

      <VoiceBar
        inspectionId={id}
        spaceId={spaceId}
        onComplete={(r) => {
          if (r.status === 'applied') void loadSpace()
        }}
      />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/inspections/$id/spaces/$spaceId')({ component: SpaceDetailPage })
