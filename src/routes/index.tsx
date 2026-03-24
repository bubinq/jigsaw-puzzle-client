import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import type { FeedItem, FeedResponse } from "@/lib/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { apiFetch, apiUrl } from "@/lib/api/client"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const { user } = useAuth()
  const [items, setItems] = React.useState<Array<FeedItem> | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    setError(null)
    setItems(null)

    if (!user) return

    void (async () => {
      try {
        const res = await apiFetch<FeedResponse>("/feed", {
          method: "GET",
          signal: controller.signal,
        })
        if (!controller.signal.aborted) setItems(res.items)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "feed_failed")
      }
    })()

    return () => {
      controller.abort()
    }
  }, [user])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Suggested puzzles</h1>
        <p className="text-sm text-muted-foreground">
          {user ? "Puzzles you haven’t played yet." : "Login to see your personalized feed."}
        </p>
      </div>

      {!user ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Login to see your feed.
          </CardContent>
        </Card>
      ) : error ? (
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
            No suggested puzzles yet. Create one!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden">
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
          ))}
        </div>
      )}
    </div>
  )
}

