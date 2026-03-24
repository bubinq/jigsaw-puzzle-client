import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = React.useState<"login" | "register">("login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (user) void navigate({ to: "/" })
  }, [user, navigate])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Login" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to access your profile and create puzzles."
            : "Register with email + password."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setPending(true)
            try {
              if (mode === "login") {
                await login(email, password)
              } else {
                await register(email, password, displayName || undefined)
              }
              await navigate({ to: "/" })
            } catch (err) {
              setError(err instanceof Error ? err.message : "request_failed")
            } finally {
              setPending(false)
            }
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          {mode === "register" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="login-display-name">Display name (optional)</Label>
              <Input
                id="login-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex"
                autoComplete="nickname"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Please wait…" : mode === "login" ? "Login" : "Register"}
          </Button>
        </form>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {mode === "login" ? (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setMode("register")
              setError(null)
            }}
            type="button"
          >
            Need an account? Register
          </Button>
        ) : (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setMode("login")
              setError(null)
            }}
            type="button"
          >
            Already have an account? Login
          </Button>
        )}
      </div>
    </div>
  )
}

