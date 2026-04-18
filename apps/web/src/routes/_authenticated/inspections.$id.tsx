import { createFileRoute } from '@tanstack/react-router'

function InspectionDetailPage() {
  const { id } = Route.useParams()
  return <div>Inspection {id} — Levels &amp; Spaces</div>
}

export const Route = createFileRoute('/_authenticated/inspections/$id')({ component: InspectionDetailPage })
