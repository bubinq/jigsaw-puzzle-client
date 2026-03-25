import type { PuzzlePiece, Rect } from "@/lib/puzzle-game"

/** Padding inside the piece bitmap for anti-aliased mask stroke (path origin offset). */
const PIECE_BITMAP_EDGE_PAD = 2
/**
 * Extra margin so the soft drop shadow is not clipped. Total inset from bitmap edge to
 * piece path (0,0) is EDGE_PAD + this value — must match `puzzle-piece-view`.
 */
const PIECE_BITMAP_SHADOW_MARGIN = 12

export const PIECE_BITMAP_PAD = PIECE_BITMAP_EDGE_PAD + PIECE_BITMAP_SHADOW_MARGIN

/** Bump when piece raster drawing (edges, shadow) changes so cached bitmaps regenerate. */
const PIECE_BITMAP_RENDER_VERSION = 2

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
    PIECE_BITMAP_PAD.toFixed(0),
    String(PIECE_BITMAP_RENDER_VERSION),
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
    const rasterScale =
      typeof window !== "undefined"
        ? Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)))
        : 1
    const edgePad = PIECE_BITMAP_EDGE_PAD
    const shadowMargin = PIECE_BITMAP_SHADOW_MARGIN

    const pieceCanvas = document.createElement("canvas")
    const pieceLogicalW = piece.renderWidth + edgePad * 2
    const pieceLogicalH = piece.renderHeight + edgePad * 2
    pieceCanvas.width = Math.max(1, Math.ceil(pieceLogicalW * rasterScale))
    pieceCanvas.height = Math.max(1, Math.ceil(pieceLogicalH * rasterScale))
    const context = pieceCanvas.getContext("2d")
    if (!context) throw new Error("piece_bitmap_no_context")
    context.scale(rasterScale, rasterScale)
    context.translate(edgePad, edgePad)

    const path = new Path2D(piece.pathData)
    context.fillStyle = "#fff"
    context.fill(path)
    context.lineWidth = edgePad * 2
    context.lineJoin = "round"
    context.strokeStyle = "#fff"
    context.stroke(path)
    context.globalCompositeOperation = "source-in"
    context.drawImage(
      image,
      piece.imageOffsetX,
      piece.imageOffsetY,
      boardRect.width,
      boardRect.height
    )

    context.globalCompositeOperation = "source-atop"

    const rw = piece.renderWidth
    const rh = piece.renderHeight
    const shade = context.createLinearGradient(0, 0, rw, rh)
    shade.addColorStop(0, "rgba(255, 255, 255, 0.08)")
    shade.addColorStop(0.42, "rgba(255, 255, 255, 0.03)")
    shade.addColorStop(1, "rgba(0, 0, 0, 0.06)")
    context.fillStyle = shade
    context.fill(path)

    // Inner shadow (light from top-left → darker bottom-right inner edge)
    context.save()
    context.clip(path)
    context.lineJoin = "round"
    context.lineWidth = 3
    context.strokeStyle = "rgba(0, 0, 0, 0.25)"
    context.shadowColor = "rgba(0, 0, 0, 0.4)"
    context.shadowBlur = 2
    context.shadowOffsetX = 1
    context.shadowOffsetY = 1
    context.stroke(path)
    context.restore()

    // Inner highlight (top-left edge catch)
    context.save()
    context.clip(path)
    context.lineJoin = "round"
    context.lineWidth = 2.5
    context.strokeStyle = "rgba(255, 255, 255, 0.15)"
    context.shadowColor = "rgba(255, 255, 255, 0.35)"
    context.shadowBlur = 1.5
    context.shadowOffsetX = -0.8
    context.shadowOffsetY = -0.8
    context.stroke(path)
    context.restore()

    // Thin edge definition (no shadow blur)
    context.save()
    context.lineJoin = "round"
    context.lineWidth = 1
    context.strokeStyle = "rgba(0, 0, 0, 0.3)"
    context.shadowBlur = 0
    context.shadowColor = "transparent"
    context.shadowOffsetX = 0
    context.shadowOffsetY = 0
    context.stroke(path)
    context.restore()

    const outW = Math.max(1, Math.ceil((piece.renderWidth + edgePad * 2 + shadowMargin * 2) * rasterScale))
    const outH = Math.max(1, Math.ceil((piece.renderHeight + edgePad * 2 + shadowMargin * 2) * rasterScale))
    const canvas = document.createElement("canvas")
    canvas.width = outW
    canvas.height = outH
    const out = canvas.getContext("2d")
    if (!out) throw new Error("piece_bitmap_no_context")
    out.scale(rasterScale, rasterScale)
    out.shadowColor = "rgba(0, 0, 0, 0.3)"
    out.shadowBlur = 5
    out.shadowOffsetX = 1.5
    out.shadowOffsetY = 2
    out.drawImage(pieceCanvas, shadowMargin, shadowMargin)

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
