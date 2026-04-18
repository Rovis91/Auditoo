import { lazy, Suspense } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
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

export const Route = createRootRoute({ component: RootComponent })
