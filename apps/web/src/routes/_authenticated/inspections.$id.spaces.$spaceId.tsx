import { createFileRoute } from '@tanstack/react-router'

function SpaceDetailPage() {
  const { id, spaceId } = Route.useParams()
  return <div>Space {spaceId} — Inspection {id}</div>
}

export const Route = createFileRoute('/_authenticated/inspections/$id/spaces/$spaceId')({ component: SpaceDetailPage })
