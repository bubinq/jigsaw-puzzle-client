import * as React from "react"
import type { AuthResponse, MeResponse, User } from "@/lib/api/types"
import { apiFetch } from "@/lib/api/client"

type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await apiFetch<MeResponse>("/auth/me", { method: "GET" })
      setUser(res.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const login = React.useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      json: { email, password },
    })
    setUser(res.user)
  }, [])

  const register = React.useCallback(
    async (email: string, password: string, displayName?: string) => {
      await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        json: { email, password, displayName: displayName || undefined },
      })
      const res = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        json: { email, password },
      })
      setUser(res.user)
    },
    [],
  )

  const logout = React.useCallback(async () => {
    await apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" })
    setUser(null)
  }, [])

  const value: AuthState = { user, loading, login, register, logout, refresh }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("AuthProvider missing")
  return ctx
}

