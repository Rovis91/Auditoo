import { lazy, Suspense } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { NotFoundPage } from '@/components/not-found-page'
import { AuthProvider } from '@/contexts'

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/router-devtools').then((m) => ({ default: m.TanStackRouterDevtools }))
    )

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>
    </AuthProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})
