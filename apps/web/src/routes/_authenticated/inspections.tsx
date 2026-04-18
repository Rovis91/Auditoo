import { createFileRoute } from '@tanstack/react-router'

function InspectionsPage() {
  return <div>Inspections</div>
}

export const Route = createFileRoute('/_authenticated/inspections')({ component: InspectionsPage })
