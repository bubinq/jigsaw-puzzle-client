import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { useDropzone } from "react-dropzone"
import type { CreatePuzzleResponse } from "@/lib/api/types"
import type { GridOption, ImageMeta } from "@/lib/puzzle-preview"
import { RequireAuth } from "@/components/auth/require-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiUrl } from "@/lib/api/client"
import {
  buildGridOptions,
  buildOverlayData,
  decodeImageMeta,
} from "@/lib/puzzle-preview"

export const Route = createFileRoute("/create")({
  component: CreatePage,
})

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function CreatePage() {
  const navigate = useNavigate()
  const [name, setName] = React.useState("")
  const [pieceIndex, setPieceIndex] = React.useState(0)
  const [tags, setTags] = React.useState("")
  const [image, setImage] = React.useState<File | null>(null)
  const [imageMeta, setImageMeta] = React.useState<ImageMeta | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null)
  const [imageError, setImageError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const gridOptions = React.useMemo(() => (imageMeta ? buildGridOptions(imageMeta) : []), [imageMeta])

  const selectedGrid = React.useMemo<GridOption | null>(() => {
    if (!gridOptions.length) return null
    return gridOptions[clampIndex(pieceIndex, gridOptions.length)]
  }, [gridOptions, pieceIndex])
  const deferredSelectedGrid = React.useDeferredValue(selectedGrid)

  React.useEffect(() => {
    if (!imagePreviewUrl) return
    return () => URL.revokeObjectURL(imagePreviewUrl)
  }, [imagePreviewUrl])

  React.useEffect(() => {
    if (!gridOptions.length) {
      setPieceIndex(0)
      return
    }
    setPieceIndex((prev) => clampIndex(prev, gridOptions.length))
  }, [gridOptions])

  const overlay = React.useMemo(() => {
    if (!deferredSelectedGrid) return null
    return buildOverlayData(
      1000,
      1000 / (deferredSelectedGrid.cols / deferredSelectedGrid.rows),
      deferredSelectedGrid.rows,
      deferredSelectedGrid.cols,
    )
  }, [deferredSelectedGrid])

  const clearImage = React.useCallback(() => {
    setImage(null)
    setImageMeta(null)
    setImageError(null)
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const onDrop = React.useCallback(
    async (acceptedFiles: Array<File>) => {
      if (acceptedFiles.length === 0) return
      const file = acceptedFiles[0]
      setError(null)
      setSuccess(null)
      setImageError(null)

      if (!file.type.startsWith("image/")) {
        clearImage()
        setImageError("Please select an image file.")
        return
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        clearImage()
        setImageError("Image must be 10MB or smaller.")
        return
      }

      try {
        const meta = await decodeImageMeta(file)
        const options = buildGridOptions(meta)
        if (options.length === 0) {
          clearImage()
          setImageError("Could not derive valid puzzle layouts for this image.")
          return
        }

        const nextPreviewUrl = URL.createObjectURL(file)
        setImagePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return nextPreviewUrl
        })
        setImage(file)
        setImageMeta(meta)
        setPieceIndex(defaultGridIndex(options))
      } catch {
        clearImage()
        setImageError("Could not read this image.")
      }
    },
    [clearImage],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    maxFiles: 1,
    onDrop,
  })

  return (
    <RequireAuth>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Create puzzle</h1>

        <Card>
          <CardContent className="pt-4">
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setError(null)
                setSuccess(null)

                if (!image) {
                  setError("image_required")
                  return
                }
                if (!image.type.startsWith("image/")) {
                  setError("invalid_image_type")
                  return
                }
                if (image.size > MAX_IMAGE_SIZE_BYTES) {
                  setError("image_too_large")
                  return
                }
                if (!selectedGrid) {
                  setError("invalid_piece_count")
                  return
                }

                const fd = new FormData()
                fd.set("image", image)
                fd.set("name", name)
                fd.set("pieceCount", String(selectedGrid.pieceCount))
                fd.set("tags", tags)

                setPending(true)
                try {
                  const res = await fetch(apiUrl("/puzzles"), {
                    method: "POST",
                    body: fd,
                    credentials: "include",
                  })
                  if (!res.ok) {
                    const j = (await res.json().catch(() => null)) as { error?: string } | null
                    throw new Error(j?.error || "create_failed")
                  }
                  const payload = (await res.json()) as CreatePuzzleResponse
                  const puzzleId = payload.puzzle.id
                  if (!puzzleId) {
                    throw new Error("create_failed")
                  }

                  setName("")
                  setTags("")
                  clearImage()
                  setPieceIndex(0)
                  await navigate({
                    to: "/puzzle/$puzzleId",
                    params: { puzzleId },
                  })
                } catch (err) {
                  setError(err instanceof Error ? err.message : "create_failed")
                } finally {
                  setPending(false)
                }
              }}
            >
              <div className="flex flex-col gap-2">
                <Label>Image</Label>
                <div
                  {...getRootProps()}
                  className="cursor-pointer rounded-md border border-dashed border-input p-4 transition hover:border-foreground/40"
                >
                  <input {...getInputProps()} />
                  <div className="text-sm">
                    {isDragActive ? "Drop image here…" : "Drop image here, or click to choose"}
                  </div>
                  <div className="pt-1 text-xs text-muted-foreground">
                    All image formats are supported (image/*). Max 10MB.
                  </div>
                </div>

                {image ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <div className="truncate">
                      <div className="font-medium">{image.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {imageMeta ? `${imageMeta.width} x ${imageMeta.height}` : "Reading image…"} -{" "}
                        {formatBytes(image.size)}
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={clearImage}>
                      Remove
                    </Button>
                  </div>
                ) : null}
                {imageError ? <div className="text-xs text-destructive">{imageError}</div> : null}
              </div>

              {imagePreviewUrl && overlay && selectedGrid ? (
                <div className="flex flex-col gap-2">
                  <Label>Preview</Label>
                  <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-md border bg-muted">
                    <img className="w-full object-contain" src={imagePreviewUrl} alt="Puzzle preview" />
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox={`-0.5 -0.5 ${overlay.width + 1} ${overlay.height + 1}`}
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <defs>
                        <filter id="puzzle-shadow">
                          <feDropShadow dx="1" dy="1" floodColor="rgba(0,0,0,1)" stdDeviation="1" />
                        </filter>
                      </defs>
                      <g style={{ filter: "url(#puzzle-shadow)" }}>
                        <path
                          d={overlay.pathData}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={1.5}
                          strokeLinecap="square"
                        />
                      </g>
                    </svg>
                  </div>
                 
                </div>
              ) : null}

              <div className="flex flex-col gap-1">
                <Label htmlFor="puzzle-name">Name</Label>
                <Input
                  id="puzzle-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sunset over the lake"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="puzzle-piece-count">Pieces</Label>
                  <span className="text-sm text-muted-foreground">
                    {selectedGrid ? selectedGrid.pieceCount : "Upload image"}
                  </span>
                </div>
                <input
                  id="puzzle-piece-count"
                  className="w-full"
                  type="range"
                  min={0}
                  max={Math.max(0, gridOptions.length - 1)}
                  value={Math.min(pieceIndex, Math.max(0, gridOptions.length - 1))}
                  disabled={!gridOptions.length}
                  onChange={(e) => setPieceIndex(Number(e.target.value))}
                />
               
              
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="puzzle-tags">Tags</Label>
                <Input
                  id="puzzle-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="nature, sunset, lake"
                />
                <div className="text-xs text-muted-foreground">
                  Comma-separated. Used for suggestions later.
                </div>
              </div>

              {error ? <div className="text-sm text-destructive">{error}</div> : null}
              {success ? <div className="text-sm text-emerald-600">{success}</div> : null}

              <Button type="submit" disabled={pending}>
                {pending ? "Uploading…" : "Create puzzle"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  )
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

function defaultGridIndex(options: Array<GridOption>): number {
  if (!options.length) return 0
  const preferredPieceCount = 100
  const exactMatchIndex = options.findIndex((option) => option.pieceCount === preferredPieceCount)
  if (exactMatchIndex >= 0) return exactMatchIndex
  return Math.max(0, Math.floor(options.length / 3))
}

