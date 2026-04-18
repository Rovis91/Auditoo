import { createFileRoute } from '@tanstack/react-router'

function EditInspectionPage() {
  const { id } = Route.useParams()
  return <div>Edit Inspection {id}</div>
}

export const Route = createFileRoute('/_authenticated/inspections/$id/edit')({ component: EditInspectionPage })
