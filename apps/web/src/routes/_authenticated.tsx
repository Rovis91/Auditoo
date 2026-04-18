import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { TOKEN_KEY } from '@/contexts'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
