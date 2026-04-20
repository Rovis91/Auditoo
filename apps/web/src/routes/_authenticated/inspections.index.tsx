import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { ChevronsLeft, Plus } from 'lucide-react'
import { SwipeRevealActionsRow } from '@/components/swipe-reveal-actions-row'
import { OfflineBar } from '@/components/offline-bar'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Inspection } from '@/lib/api-types'
import { cn } from '@/lib/utils'

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

function formatUpdated(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sortInspections(a: Inspection, b: Inspection) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

function InspectionsListPage() {
  const navigate = useNavigate()
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Inspection | null>(null)

  useEffect(() => {
    api
      .get<Inspection[]>('/inspections')
      .then(setInspections)
      .catch(() => setError('Impossible de charger les inspections.'))
      .finally(() => setLoading(false))
  }, [])

  const requestDelete = useCallback((insp: Inspection) => {
    setDeleteError(null)
    setPendingDelete(insp)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    const insp = pendingDelete
    if (!insp) return
    setPendingDelete(null)
    setInspections((prev) => prev.filter((i) => i.id !== insp.id))
    setDeleteError(null)
    try {
      await api.delete(`/inspections/${insp.id}`)
    } catch {
      setInspections((prev) => [...prev, insp].sort(sortInspections))
      setDeleteError('Impossible de supprimer cette inspection. Réessayez.')
    }
  }, [pendingDelete])

  return (
    <div className="min-h-screen bg-background">
      <OfflineBar />

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Inspections</h1>
        <Button
          size="sm"
          className="min-h-11 text-white"
          onClick={() => navigate({ to: '/inspections/new' })}
          data-testid="inspections-new"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nouvelle
        </Button>
      </header>

      <main className="p-4 space-y-3 max-w-2xl mx-auto" data-testid="inspections-list">
        {deleteError && (
          <p className="text-sm text-destructive text-center rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            {deleteError}
          </p>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
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
          <SwipeRevealActionsRow
            key={insp.id}
            onEdit={() =>
              navigate({ to: '/inspections/$id/edit', params: { id: insp.id } })
            }
            onDelete={() => requestDelete(insp)}
            editButtonTestId="inspection-swipe-edit"
            deleteButtonTestId="inspection-swipe-delete"
          >
            <Link
              to="/inspections/$id"
              params={{ id: insp.id }}
              data-testid="inspection-card"
              data-inspection-id={insp.id}
              className={cn(
                'flex gap-3 min-h-11 p-4 text-left w-full',
                'hover:bg-accent/80 transition-colors active:bg-accent/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              )}
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-card-foreground truncate pr-1">
                    {insp.owner_name || 'Sans nom'}
                  </span>
                  <Badge
                    variant={statusVariant(insp.status)}
                    className={cn(
                      'text-xs shrink-0',
                      insp.status !== 'completed' &&
                        'bg-amber-100 text-amber-950 border-amber-200/80 dark:bg-amber-950 dark:text-amber-50 dark:border-amber-800',
                    )}
                  >
                    {statusLabel(insp.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{insp.address || '—'}</p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{formatDate(insp.date)}</span>
                  <span className="text-muted-foreground/80">
                    Modifié {formatUpdated(insp.updated_at)}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center justify-center self-stretch pl-0.5 pointer-events-none">
                <ChevronsLeft
                  aria-hidden
                  className={cn(
                    'h-5 w-5 text-muted-foreground/35 transition-transform duration-150 ease-out will-change-transform',
                    'rotate-[calc(var(--swipe-openness,0)*180deg)]',
                  )}
                  strokeWidth={1.75}
                />
                <span className="sr-only">
                  Glisser vers la gauche pour modifier ou supprimer
                </span>
              </div>
            </Link>
          </SwipeRevealActionsRow>
        ))}
      </main>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette inspection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Les niveaux et espaces associés seront supprimés avec
              l&apos;inspection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              className="min-h-11 sm:min-h-10"
              data-testid="inspection-delete-confirm"
              onClick={() => void handleConfirmDelete()}
            >
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/inspections/')({
  component: InspectionsListPage,
})
