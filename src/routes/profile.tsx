import { Link, createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { RequireAuth } from "@/components/auth/require-auth"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import type { FeedItem, FeedResponse } from "@/lib/api/types"
import { apiFetch, apiUrl } from "@/lib/api/client"

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const { user } = useAuth()
  const [items, setItems] = React.useState<Array<FeedItem> | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    setItems(null)
    setError(null)
    void (async () => {
      try {
        const res = await apiFetch<FeedResponse>("/puzzles/mine", {
          method: "GET",
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setItems(res.items)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "my_puzzles_failed")
        }
      }
    })()
    return () => controller.abort()
  }, [user])

  return (
    <RequireAuth>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your puzzles</h1>
          <p className="text-sm text-muted-foreground">
            Puzzles you created on your account.
          </p>
        </div>
        {error ? (
          <Card>
            <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : !items ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              You have not created puzzles yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Link
                key={p.id}
                to="/puzzle/$puzzleId"
                params={{ puzzleId: p.id }}
                className="block"
              >
                <Card className="overflow-hidden transition hover:border-primary/50">
                  <div className="aspect-4/3 w-full bg-muted">
                    <img
                      className="h-full w-full object-cover"
                      src={apiUrl(p.imageUrl)}
                      alt={p.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <div className="font-medium leading-tight">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{p.pieceCount} pieces</div>
                    {p.tags.length ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.tags.slice(0, 6).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  )
}

