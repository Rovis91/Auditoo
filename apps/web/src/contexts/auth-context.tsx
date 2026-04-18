import { createContext, useContext, useState } from 'react'

export const TOKEN_KEY = 'auditoo_token'

interface AuthContextValue {
  token: string | null
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  function login(newToken: string) {
    setToken(newToken)
    localStorage.setItem(TOKEN_KEY, newToken)
  }

  function logout() {
    setToken(null)
    localStorage.removeItem(TOKEN_KEY)
  }

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
