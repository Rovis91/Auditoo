import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { InspectionForm } from '@/components/inspection-form'
import { api } from '@/lib/api'
import type { Inspection, InspectionWithLevels } from '@/lib/api-types'

function EditInspectionPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    api.get<InspectionWithLevels>(`/inspections/${id}`).then(setInspection)
  }, [id])

  async function handleSubmit(fields: Partial<Inspection>) {
    setIsLoading(true)
    try {
      await api.patch<Inspection>(`/inspections/${id}`, fields)
      navigate({ to: '/inspections/$id', params: { id } })
    } finally {
      setIsLoading(false)
    }
  }

  if (!inspection) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-48 h-4 bg-muted animate-pulse rounded" />
    </div>
  }

  return (
    <InspectionForm
      inspection={inspection}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      backTo={`/inspections/${id}`}
    />
  )
}

export const Route = createFileRoute('/_authenticated/inspections/$id/edit')({ component: EditInspectionPage })
