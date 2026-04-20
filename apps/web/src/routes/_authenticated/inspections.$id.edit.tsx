import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { InspectionForm } from '@/components/inspection-form'
import { api } from '@/lib/api'
import type { Inspection, InspectionWithLevels } from '@/lib/api-types'

function EditInspectionPage() {
  const { id } = Route.useParams()
  const [inspection, setInspection] = useState<Inspection | null>(null)

  useEffect(() => {
    api.get<InspectionWithLevels>(`/inspections/${id}`).then(setInspection)
  }, [id])

  if (!inspection) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-48 h-4 bg-muted animate-pulse rounded" />
    </div>
  }

  return (
    <InspectionForm
      inspection={inspection}
      onAutosave={async (fields) => {
        await api.patch<Inspection>(`/inspections/${id}`, fields)
      }}
      backTo={`/inspections/${id}`}
    />
  )
}

export const Route = createFileRoute('/_authenticated/inspections/$id/edit')({ component: EditInspectionPage })
