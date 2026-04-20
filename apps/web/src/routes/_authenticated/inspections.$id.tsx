import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { clearVoiceHighlights } from '@/lib/voice-highlights'

function InspectionByIdLayout() {
  const { id } = Route.useParams()

  useEffect(() => {
    return () => {
      clearVoiceHighlights(id)
    }
  }, [id])

  return <Outlet />
}

export const Route = createFileRoute('/_authenticated/inspections/$id')({
  component: InspectionByIdLayout,
})
