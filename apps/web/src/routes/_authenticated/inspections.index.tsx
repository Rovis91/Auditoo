import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Inspection } from '@/lib/api-types'

function statusLabel(status: string) {
  return status === 'completed' ? 'Terminée' : 'Brouillon'
}

function statusVariant(status: string): 'default' | 'secondary' {
  return status === 'completed' ? 'default' : 'secondary'
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

function InspectionsListPage() {
  const navigate = useNavigate()
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Inspection[]>('/inspections')
      .then(setInspections)
      .catch(() => setError('Impossible de charger les inspections.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inspections</h1>
        <Button
          size="sm"
          className="min-h-11"
          onClick={() => navigate({ to: '/inspections/new' })}
          data-testid="inspections-new"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nouvelle
        </Button>
      </header>

      <main className="p-4 space-y-3 max-w-2xl mx-auto" data-testid="inspections-list">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive text-center py-8">{error}</p>}

        {!loading && !error && inspections.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-muted-foreground">Aucune inspection pour le moment.</p>
            <Button variant="outline" onClick={() => navigate({ to: '/inspections/new' })}>
              Créer une inspection
            </Button>
          </div>
        )}

        {inspections.map((insp) => (
          <button
            key={insp.id}
            type="button"
            data-testid="inspection-card"
            data-inspection-id={insp.id}
            className="w-full text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:bg-accent transition-colors active:scale-[0.99]"
            onClick={() => navigate({ to: '/inspections/$id', params: { id: insp.id } })}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-card-foreground truncate">
                {insp.owner_name || 'Sans nom'}
              </span>
              <Badge variant={statusVariant(insp.status)} className="shrink-0 text-xs">
                {statusLabel(insp.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{insp.address || '—'}</p>
            <p className="text-xs text-muted-foreground">{formatDate(insp.date)}</p>
          </button>
        ))}
      </main>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/inspections/')({
  component: InspectionsListPage,
})
