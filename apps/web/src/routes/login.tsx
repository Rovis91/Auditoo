import { createFileRoute } from '@tanstack/react-router'

function LoginPage() {
  return <div>Login</div>
}

export const Route = createFileRoute('/login')({ component: LoginPage })
