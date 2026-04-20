import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { useVoiceHighlights } from '@/hooks/use-voice-highlights'
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

/** Debounced autosave interval (ms); matches space detail pattern — `setTimeout` in a ref (React-friendly, no extra deps). */
const AUTOSAVE_DEBOUNCE_MS = 400

interface InspectionFormProps {
  inspection?: Inspection
  /** Required when creating an inspection (`!inspection?.id`). */
  onSubmit?: (fields: Partial<Inspection>) => Promise<void>
  /** Required when editing (`inspection.id`); debounced PATCH from field changes. */
  onAutosave?: (fields: Partial<Inspection>) => Promise<void>
  /** Shown only for the create flow submit button. */
  isLoading?: boolean
  backTo: string
}

export function InspectionForm({ inspection, onSubmit, onAutosave, isLoading = false, backTo }: InspectionFormProps) {
  const navigate = useNavigate()
  const vh = useVoiceHighlights(inspection?.id ?? '')
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

  const isEdit = Boolean(inspection?.id)
  const isEditRef = useRef(isEdit)
  const fieldsRef = useRef(fields)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentPayloadKeyRef = useRef<string | null>(null)
  const onAutosaveRef = useRef(onAutosave)
  const inspectionRef = useRef(inspection)

  useLayoutEffect(() => {
    isEditRef.current = isEdit
    fieldsRef.current = fields
    onAutosaveRef.current = onAutosave
    inspectionRef.current = inspection
  }, [isEdit, fields, onAutosave, inspection])

  const buildPayload = useCallback((f: typeof fields): Partial<Inspection> => ({
    owner_name: f.owner_name || null,
    address: f.address || null,
    date: f.date || null,
    status: f.status,
    construction_year: f.construction_year ? Number(f.construction_year) : null,
    living_area: f.living_area ? Number(f.living_area) : null,
    heating_type: f.heating_type || null,
    hot_water_system: f.hot_water_system || null,
    ventilation_type: f.ventilation_type || null,
    insulation_context: f.insulation_context || null,
  }), [])

  const flushPersist = useCallback(async () => {
    if (!isEdit || !onAutosaveRef.current) return
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    const payload = buildPayload(fieldsRef.current)
    const key = JSON.stringify(payload)
    if (key === lastSentPayloadKeyRef.current) return
    try {
      await onAutosaveRef.current(payload)
      lastSentPayloadKeyRef.current = key
      setError(null)
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    }
  }, [buildPayload, isEdit])

  const schedulePersist = useCallback(() => {
    if (!isEdit) return
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null
      void flushPersist()
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [flushPersist, isEdit])

  // Reset local fields when navigating to another inspection (`id` only in deps — avoids wiping edits when the parent passes a new object reference).
  useEffect(() => {
    const insp = inspectionRef.current
    if (!insp?.id) {
      lastSentPayloadKeyRef.current = null
      return
    }
    const initial = {
      owner_name: insp.owner_name ?? '',
      address: insp.address ?? '',
      date: insp.date ?? '',
      status: insp.status ?? 'draft',
      construction_year: insp.construction_year?.toString() ?? '',
      living_area: insp.living_area?.toString() ?? '',
      heating_type: insp.heating_type ?? '',
      hot_water_system: insp.hot_water_system ?? '',
      ventilation_type: insp.ventilation_type ?? '',
      insulation_context: insp.insulation_context ?? '',
    }
    setFields(initial)
    fieldsRef.current = initial
    lastSentPayloadKeyRef.current = JSON.stringify(buildPayload(initial))
  }, [buildPayload, inspection?.id])

  // Flush pending debounced edits only on real unmount (see React `useEffect` cleanup docs).
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      if (!isEditRef.current || !onAutosaveRef.current) return
      const payload = buildPayload(fieldsRef.current)
      const key = JSON.stringify(payload)
      if (key !== lastSentPayloadKeyRef.current) {
        void onAutosaveRef.current(payload).catch(() => {})
      }
    }
  }, [buildPayload])

  const validInspectionDate = (() => {
    if (!fields.date) return undefined
    const d = parse(fields.date, 'yyyy-MM-dd', new Date())
    return Number.isNaN(d.getTime()) ? undefined : d
  })()

  function set(key: string, value: string) {
    setFields((f) => {
      const next = { ...f, [key]: value }
      fieldsRef.current = next
      return next
    })
    if (isEdit) schedulePersist()
  }

  function setDiscrete(key: string, value: string) {
    setFields((f) => {
      const next = { ...f, [key]: value }
      fieldsRef.current = next
      return next
    })
    if (isEdit) queueMicrotask(() => void flushPersist())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit || !onSubmit) return
    setError(null)
    try {
      await onSubmit(buildPayload(fields))
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
        {isEdit && (
          <p className="text-xs text-muted-foreground" data-testid="inspection-autosave-hint">
            Enregistrement automatique après {AUTOSAVE_DEBOUNCE_MS / 1000} s sans modification.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="owner_name">Nom du propriétaire</Label>
          <Input
            id="owner_name"
            data-testid="inspection-owner-name"
            value={fields.owner_name}
            className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'owner_name')))}
            onChange={(e) => set('owner_name', e.target.value)}
            onFocus={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'owner_name')}
            placeholder="Jean Dupont"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            value={fields.address}
            className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'address')))}
            onChange={(e) => set('address', e.target.value)}
            onFocus={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'address')}
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
                  !validInspectionDate && 'text-muted-foreground',
                  inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'date')),
                )}
                onPointerDown={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'date')}
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
                  const next = d ? format(d, 'yyyy-MM-dd') : ''
                  setFields((f) => {
                    const merged = { ...f, date: next }
                    fieldsRef.current = merged
                    return merged
                  })
                  setDateOpen(false)
                  if (isEdit) queueMicrotask(() => void flushPersist())
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={fields.status} onValueChange={(v) => setDiscrete('status', v)}>
            <SelectTrigger
              className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'status')))}
              onPointerDown={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'status')}
            >
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
              className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'construction_year')))}
              onChange={(e) => set('construction_year', e.target.value)}
              onFocus={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'construction_year')}
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
              className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'living_area')))}
              onChange={(e) => set('living_area', e.target.value)}
              onFocus={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'living_area')}
              placeholder="95"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Système de chauffage</Label>
          <Select value={fields.heating_type} onValueChange={(v) => setDiscrete('heating_type', v)}>
            <SelectTrigger
              className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'heating_type')))}
              onPointerDown={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'heating_type')}
            >
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {HEATING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Eau chaude sanitaire</Label>
          <Select value={fields.hot_water_system} onValueChange={(v) => setDiscrete('hot_water_system', v)}>
            <SelectTrigger
              className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'hot_water_system')))}
              onPointerDown={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'hot_water_system')}
            >
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {HOT_WATER_SYSTEMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ventilation</Label>
          <Select value={fields.ventilation_type} onValueChange={(v) => setDiscrete('ventilation_type', v)}>
            <SelectTrigger
              className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'ventilation_type')))}
              onPointerDown={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'ventilation_type')}
            >
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
            className={cn(inspection?.id && vh.ringClass(vh.fieldTone('inspections', inspection.id, 'insulation_context')))}
            onChange={(e) => set('insulation_context', e.target.value)}
            onFocus={() => inspection?.id && vh.consumeField('inspections', inspection.id, 'insulation_context')}
            placeholder="Notes sur l'isolation…"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isEdit && (
          <Button type="submit" className="w-full min-h-11" disabled={isLoading} data-testid="inspection-submit">
            {isLoading ? 'Enregistrement…' : 'Créer l\'inspection'}
          </Button>
        )}
      </form>
    </div>
  )
}
