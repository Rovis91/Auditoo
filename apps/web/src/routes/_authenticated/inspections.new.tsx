import { createFileRoute } from '@tanstack/react-router'

function NewInspectionPage() {
  return <div>New Inspection</div>
}

export const Route = createFileRoute('/_authenticated/inspections/new')({ component: NewInspectionPage })
