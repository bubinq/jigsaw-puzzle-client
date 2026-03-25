import { afterEach, describe, expect, it, vi } from "vitest"
import { buildPuzzlePieces } from "@/lib/puzzle-game"
import {
  buildAllPieceBitmapDataUrls,
  buildPieceBitmapDataUrl,
  clearPieceBitmapCache,
} from "@/lib/puzzle-piece-raster"

describe("puzzle-piece-raster", () => {
  afterEach(() => {
    clearPieceBitmapCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("retries bitmap generation after a failed cached attempt", async () => {
    let exportCallCount = 0

    class FakeImage {
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      crossOrigin: string | null = null
      #src = ""

      set src(value: string) {
        this.#src = value
        queueMicrotask(() => this.onload?.())
      }

      get src() {
        return this.#src
      }
    }

    function makeFakeContext() {
      return {
        save: vi.fn(),
        clip: vi.fn(),
        drawImage: vi.fn(),
        restore: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: "",
        lineWidth: 0,
        filter: "",
        scale: vi.fn(),
        translate: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
      }
    }

    vi.stubGlobal("Image", FakeImage as unknown as typeof Image)
    vi.stubGlobal("Path2D", class {} as typeof Path2D)
    vi.stubGlobal("document", {
      createElement: vi.fn(() => {
        const fakeContext = makeFakeContext()
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => fakeContext),
          toDataURL: vi.fn(() => {
            exportCallCount += 1
            if (exportCallCount === 1) {
              throw new Error("first_export_fails")
            }
            return "data:image/png;base64,ok"
          }),
        }
      }),
    } as unknown as Document)

    const board = { left: 0, top: 0, width: 400, height: 300 }
    const piece = buildPuzzlePieces(2, 2, board)[0]
    await expect(
      buildPieceBitmapDataUrl(piece, "https://example.com/puzzle.jpg", board)
    ).rejects.toThrow("first_export_fails")

    await expect(
      buildPieceBitmapDataUrl(piece, "https://example.com/puzzle.jpg", board)
    ).resolves.toBe("data:image/png;base64,ok")
    expect(exportCallCount).toBe(2)
  })

  it("builds all piece bitmap data URLs keyed by piece id", async () => {
    class FakeImage {
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      crossOrigin: string | null = null
      #src = ""

      set src(value: string) {
        this.#src = value
        queueMicrotask(() => this.onload?.())
      }

      get src() {
        return this.#src
      }
    }

    function makeFakeContext() {
      return {
        save: vi.fn(),
        clip: vi.fn(),
        drawImage: vi.fn(),
        restore: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: "",
        lineWidth: 0,
        filter: "",
        scale: vi.fn(),
        translate: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
      }
    }

    vi.stubGlobal("Image", FakeImage as unknown as typeof Image)
    vi.stubGlobal("Path2D", class {} as typeof Path2D)
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => makeFakeContext()),
        toDataURL: vi.fn(() => "data:image/png;base64,ok"),
      })),
    } as unknown as Document)

    const board = { left: 0, top: 0, width: 400, height: 300 }
    const pieces = buildPuzzlePieces(2, 2, board)
    const bitmapMap = await buildAllPieceBitmapDataUrls(
      pieces,
      "https://example.com/puzzle.jpg",
      board
    )

    expect(bitmapMap.size).toBe(pieces.length)
    for (const piece of pieces) {
      expect(bitmapMap.get(piece.id)).toBe("data:image/png;base64,ok")
    }
  })
})
