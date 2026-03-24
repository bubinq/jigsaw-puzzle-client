import { useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { useAuth } from "@/hooks/use-auth"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" })
  }, [loading, user, navigate])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>
  if (!user) return null
  return <>{children}</>
}

