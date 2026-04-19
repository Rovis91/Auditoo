import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { InspectionForm } from '@/components/inspection-form'
import { api } from '@/lib/api'
import type { Inspection } from '@/lib/api-types'

function NewInspectionPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(fields: Partial<Inspection>) {
    setIsLoading(true)
    try {
      const created = await api.post<Inspection>('/inspections', fields)
      navigate({ to: '/inspections/$id', params: { id: created.id } })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <InspectionForm
      onSubmit={handleSubmit}
      isLoading={isLoading}
      backTo="/inspections"
    />
  )
}

export const Route = createFileRoute('/_authenticated/inspections/new')({ component: NewInspectionPage })
