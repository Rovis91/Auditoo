import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format, parse } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Inspection } from '@/lib/api-types'

const HEATING_TYPES = [
  'Électrique', 'Gaz naturel', 'Fioul', 'Pompe à chaleur', 'Bois/biomasse',
  'Réseau de chaleur', 'Solaire thermique', 'Autre',
]
const HOT_WATER_SYSTEMS = [
  'Chauffe-eau électrique', 'Chauffe-eau thermodynamique', 'Chaudière gaz',
  'Chaudière fioul', 'Solaire', 'Réseau de chaleur', 'Autre',
]
const VENTILATION_TYPES = ['VMC simple flux', 'VMC double flux', 'Ventilation naturelle', 'Autre']

interface InspectionFormProps {
  inspection?: Inspection
  onSubmit: (fields: Partial<Inspection>) => Promise<void>
  isLoading: boolean
  backTo: string
}

export function InspectionForm({ inspection, onSubmit, isLoading, backTo }: InspectionFormProps) {
  const navigate = useNavigate()
  const [fields, setFields] = useState({
    owner_name: inspection?.owner_name ?? '',
    address: inspection?.address ?? '',
    date: inspection?.date ?? '',
    status: inspection?.status ?? 'draft',
    construction_year: inspection?.construction_year?.toString() ?? '',
    living_area: inspection?.living_area?.toString() ?? '',
    heating_type: inspection?.heating_type ?? '',
    hot_water_system: inspection?.hot_water_system ?? '',
    ventilation_type: inspection?.ventilation_type ?? '',
    insulation_context: inspection?.insulation_context ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [dateOpen, setDateOpen] = useState(false)

  const validInspectionDate = (() => {
    if (!fields.date) return undefined
    const d = parse(fields.date, 'yyyy-MM-dd', new Date())
    return Number.isNaN(d.getTime()) ? undefined : d
  })()

  function set(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit({
        owner_name: fields.owner_name || null,
        address: fields.address || null,
        date: fields.date || null,
        status: fields.status,
        construction_year: fields.construction_year ? Number(fields.construction_year) : null,
        living_area: fields.living_area ? Number(fields.living_area) : null,
        heating_type: fields.heating_type || null,
        hot_water_system: fields.hot_water_system || null,
        ventilation_type: fields.ventilation_type || null,
        insulation_context: fields.insulation_context || null,
      })
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: backTo as '/' })}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">
          {inspection ? 'Modifier l\'inspection' : 'Nouvelle inspection'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10" data-testid="inspection-form">
        <div className="space-y-2">
          <Label htmlFor="owner_name">Nom du propriétaire</Label>
          <Input
            id="owner_name"
            data-testid="inspection-owner-name"
            value={fields.owner_name}
            onChange={(e) => set('owner_name', e.target.value)}
            placeholder="Jean Dupont"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            value={fields.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="12 rue de la Paix, 75001 Paris"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date d'inspection</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="date"
                type="button"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !validInspectionDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {validInspectionDate
                  ? format(validInspectionDate, 'PPP', { locale: fr })
                  : 'Choisir une date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={fr}
                selected={validInspectionDate}
                onSelect={(d) => {
                  set('date', d ? format(d, 'yyyy-MM-dd') : '')
                  setDateOpen(false)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={fields.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="construction_year">Année de construction</Label>
            <Input
              id="construction_year"
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              value={fields.construction_year}
              onChange={(e) => set('construction_year', e.target.value)}
              placeholder="1985"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="living_area">Surface habitable (m²)</Label>
            <Input
              id="living_area"
              type="number"
              min={0}
              step={0.1}
              value={fields.living_area}
              onChange={(e) => set('living_area', e.target.value)}
              placeholder="95"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Système de chauffage</Label>
          <Select value={fields.heating_type} onValueChange={(v) => set('heating_type', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {HEATING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Eau chaude sanitaire</Label>
          <Select value={fields.hot_water_system} onValueChange={(v) => set('hot_water_system', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {HOT_WATER_SYSTEMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ventilation</Label>
          <Select value={fields.ventilation_type} onValueChange={(v) => set('ventilation_type', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {VENTILATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="insulation_context">Contexte isolation</Label>
          <Input
            id="insulation_context"
            value={fields.insulation_context}
            onChange={(e) => set('insulation_context', e.target.value)}
            placeholder="Notes sur l'isolation…"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full min-h-11" disabled={isLoading} data-testid="inspection-submit">
          {isLoading ? 'Enregistrement…' : inspection ? 'Enregistrer les modifications' : 'Créer l\'inspection'}
        </Button>
      </form>
    </div>
  )
}
