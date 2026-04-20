import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts'
import { api } from '@/lib/api'

function LoginForm({
  className,
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  ...props
}: React.ComponentProps<'div'> & {
  email: string
  password: string
  error: string | null
  loading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bon retour</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} data-testid="login-form">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  data-testid="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="agent@exemple.com"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-4 hover:underline text-muted-foreground"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                <Input
                  id="password"
                  data-testid="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                />
              </Field>
              {error && (
                <p className="text-sm text-destructive" data-testid="login-error">
                  {error}
                </p>
              )}
              <Field>
                <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
                  {loading ? 'Connexion…' : 'Se connecter'}
                </Button>
                <FieldDescription className="text-center">
                  Pas encore de compte ?{' '}
                  <a href="#" className="underline-offset-4 hover:underline">
                    S&apos;inscrire
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        En continuant, vous acceptez nos{' '}
        <a href="#" className="underline-offset-4 hover:underline">
          conditions d&apos;utilisation
        </a>{' '}
        et notre{' '}
        <a href="#" className="underline-offset-4 hover:underline">
          politique de confidentialité
        </a>
        .
      </FieldDescription>
    </div>
  )
}

function LoginPage() {
  const { login, token } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) {
      void navigate({ to: '/inspections' })
    }
  }, [token, navigate])

  if (token) {
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token: newToken } = await api.post<{ token: string }>('/auth/login', { email, password })
      login(newToken)
      navigate({ to: '/inspections' })
    } catch {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center justify-center gap-3 self-center font-medium">
          <img
            src="/auditoo-logo.webp"
            alt="Auditoo"
            className="h-9 w-auto object-contain"
            width={180}
            height={36}
            decoding="async"
          />
        </a>
        <LoginForm
          email={email}
          password={password}
          error={error}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/login')({ component: LoginPage })
