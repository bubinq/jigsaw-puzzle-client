import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { RequireAuth } from "@/components/auth/require-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { useSoundPreferences } from "@/hooks/use-sound-preferences"
import { useTheme } from "@/hooks/use-theme"
import { apiSameOriginUrl } from "@/lib/api/client"
import { Switch } from "@/components/ui/switch"

const DEFAULT_AVATAR_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23e5e7eb'/><circle cx='32' cy='24' r='12' fill='%239ca3af'/><path d='M12 58c3-12 13-18 20-18s17 6 20 18' fill='%239ca3af'/></svg>"

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name || email || "U").trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (!parts.length) return "U"
  const first = parts[0]?.[0] || ""
  const second = parts[1]?.[0] || ""
  return `${first}${second}`.toUpperCase()
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const { user, refresh } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { pieceMatchSoundEnabled, setPieceMatchSoundEnabled } = useSoundPreferences()
  const [uploading, setUploading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const avatarSrc = user?.avatarUrl ? apiSameOriginUrl(user.avatarUrl) : DEFAULT_AVATAR_DATA_URI

  async function onAvatarUpload(file: File) {
    setUploading(true)
    setMessage(null)
    setError(null)
    try {
      const form = new FormData()
      form.set("avatar", file)
      const res = await fetch(apiSameOriginUrl("/users/me/avatar"), {
        method: "POST",
        body: form,
        credentials: "include",
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({ error: "avatar_update_failed" }))) as {
          error?: string
        }
        throw new Error(json.error || "avatar_update_failed")
      }
      await refresh()
      setMessage("Profile photo updated.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "avatar_update_failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <RequireAuth>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 border border-border">
                <AvatarImage src={avatarSrc} alt={user?.displayName || user?.email || "Profile"} />
                <AvatarFallback>{initials(user?.displayName, user?.email)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="text-sm font-medium">{user?.displayName || "User"}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0]
                  if (file) void onAvatarUpload(file)
                }}
              />
            </div>
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">Theme</span>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === "dark" ? "Switch to light" : "Switch to dark"}
              </Button>
            </div>
            <Separator />
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="piece-match-sound">Piece match sound</Label>
                <p className="text-sm text-muted-foreground">
                  Play a snap sound when puzzle pieces connect.
                </p>
              </div>
              <Switch
                id="piece-match-sound"
                checked={pieceMatchSoundEnabled}
                onCheckedChange={setPieceMatchSoundEnabled}
                aria-label="Toggle piece match sound"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  )
}

