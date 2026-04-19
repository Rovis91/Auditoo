import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
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
import { api } from '@/lib/api'
import type { InspectionWithLevels, Space } from '@/lib/api-types'
import { VOICE_SYNCED_EVENT } from '@/lib/sync'

const GLAZING_TYPES = ['Simple vitrage', 'Double vitrage', 'Triple vitrage']
const HEATING_TYPES = [
  'Radiateurs électriques', 'Plancher chauffant', 'Radiateurs eau chaude',
  'Convecteurs', 'Pompe à chaleur', 'Poêle', 'Autre',
]
const VENTILATION_TYPES = ['VMC simple flux', 'VMC double flux', 'Ventilation naturelle', 'Insufflation', 'Autre']
const INSULATION_RATINGS = ['Très bonne', 'Bonne', 'Moyenne', 'Mauvaise', 'Très mauvaise']

function SpaceDetailPage() {
  const { id, spaceId } = Route.useParams()
  const navigate = useNavigate()
  const [space, setSpace] = useState<Space | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: '/inspections/$id', params: { id } })}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold truncate">{space.name}</h1>
      </header>

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Nom de l'espace</Label>
          <Input
            id="name"
            value={space.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onBlur={(e) => autosave('name', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="area">Surface (m²)</Label>
            <Input
              id="area"
              type="number"
              min={0}
              step={0.1}
              value={space.area ?? ''}
              onChange={(e) => handleChange('area', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="window_count">Nb. fenêtres</Label>
            <Input
              id="window_count"
              type="number"
              min={0}
              value={space.window_count ?? ''}
              onChange={(e) => handleChange('window_count', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Type de vitrage</Label>
          <Select
            value={space.glazing_type ?? ''}
            onValueChange={(v) => handleChange('glazing_type', v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {GLAZING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Heating */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="heating_presence">Chauffage présent</Label>
            <Switch
              id="heating_presence"
              checked={space.heating_presence}
              onCheckedChange={(v) => handleChange('heating_presence', v)}
            />
          </div>

          {space.heating_presence && (
            <div className="space-y-2">
              <Label>Type de chauffage</Label>
              <Select
                value={space.heating_type ?? ''}
                onValueChange={(v) => handleChange('heating_type', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {HEATING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Ventilation */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ventilation_presence">Ventilation présente</Label>
            <Switch
              id="ventilation_presence"
              checked={space.ventilation_presence}
              onCheckedChange={(v) => handleChange('ventilation_presence', v)}
            />
          </div>

          {space.ventilation_presence && (
            <div className="space-y-2">
              <Label>Type de ventilation</Label>
              <Select
                value={space.ventilation_type ?? ''}
                onValueChange={(v) => handleChange('ventilation_type', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {VENTILATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Note d'isolation</Label>
          <Select
            value={space.insulation_rating ?? ''}
            onValueChange={(v) => handleChange('insulation_rating', v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {INSULATION_RATINGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <VoiceBar
        inspectionId={id}
        spaceId={spaceId}
        onComplete={(r) => { if (r.status === 'applied') void loadSpace() }}
      />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/inspections/$id/spaces/$spaceId')({ component: SpaceDetailPage })
