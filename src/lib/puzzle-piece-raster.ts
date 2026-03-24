import type { PuzzlePiece, Rect } from "@/lib/puzzle-game"

const imagePromiseCache = new Map<string, Promise<HTMLImageElement>>()
const pieceBitmapPromiseCache = new Map<string, Promise<string>>()

function loadImageFromBlobUrl(blobUrl: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("piece_bitmap_image_load_failed"))
    image.src = blobUrl
  })
}

async function loadImageFromFetch(imageSrc: string): Promise<HTMLImageElement> {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    throw new Error("piece_bitmap_fetch_unavailable")
  }
  const response = await fetch(imageSrc, {
    credentials: "include",
  })
  if (!response.ok) {
    throw new Error(`piece_bitmap_fetch_failed:${response.status}`)
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  try {
    return await loadImageFromBlobUrl(blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

function loadImage(imageSrc: string): Promise<HTMLImageElement> {
  const cached = imagePromiseCache.get(imageSrc)
  if (cached) return cached
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    void loadImageFromFetch(imageSrc)
      .then((image) => resolve(image))
      .catch(() => {
        function tryLoadAnonymous(onFailure: () => void) {
          const image = new Image()
          image.crossOrigin = "anonymous"
          image.onload = () => resolve(image)
          image.onerror = onFailure
          image.src = imageSrc
        }

        // Never fall back to non-CORS image loading because that taints the canvas
        // and makes toDataURL/export fail.
        tryLoadAnonymous(() => reject(new Error("piece_bitmap_image_load_failed")))
      })
  })
  imagePromiseCache.set(imageSrc, promise)
  return promise
}

function pieceBitmapCacheKey(piece: PuzzlePiece, imageSrc: string, boardRect: Rect): string {
  return [
    imageSrc,
    boardRect.width.toFixed(3),
    boardRect.height.toFixed(3),
    piece.renderWidth.toFixed(3),
    piece.renderHeight.toFixed(3),
    piece.pathData,
    piece.renderKey,
  ].join("|")
}

export async function buildPieceBitmapDataUrl(
  piece: PuzzlePiece,
  imageSrc: string,
  boardRect: Rect
): Promise<string> {
  const key = pieceBitmapCacheKey(piece, imageSrc, boardRect)
  const cached = pieceBitmapPromiseCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    const image = await loadImage(imageSrc)
    const width = Math.max(1, Math.ceil(piece.renderWidth))
    const height = Math.max(1, Math.ceil(piece.renderHeight))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("piece_bitmap_no_context")

    const path = new Path2D(piece.pathData)
    context.save()
    context.clip(path)
    context.drawImage(
      image,
      piece.imageOffsetX,
      piece.imageOffsetY,
      boardRect.width,
      boardRect.height
    )
    context.restore()
    context.save()
    context.strokeStyle = "rgb(255 255 255 / 0.7)"
    context.lineWidth = 1
    context.stroke(path)
    context.strokeStyle = "rgb(0 0 0 / 0.45)"
    context.lineWidth = 0.8
    context.stroke(path)
    context.restore()
    return canvas.toDataURL("image/png")
  })().catch((error) => {
    pieceBitmapPromiseCache.delete(key)
    throw error
  })

  pieceBitmapPromiseCache.set(key, promise)
  return promise
}

export async function buildAllPieceBitmapDataUrls(
  pieces: Array<PuzzlePiece>,
  imageSrc: string,
  boardRect: Rect
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    pieces.map(async (piece) => [piece.id, await buildPieceBitmapDataUrl(piece, imageSrc, boardRect)] as const)
  )
  return new Map(entries)
}

export function clearPieceBitmapCache() {
  pieceBitmapPromiseCache.clear()
}
