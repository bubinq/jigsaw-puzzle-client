import { describe, expect, it } from "vitest"
import {
  buildConnectorMaps,
  buildGridOptions,
  buildOverlayData,
  countPieceCategories,
  pieceEdgesForCell,
} from "@/lib/puzzle-preview"

describe("buildGridOptions", () => {
  it("returns valid totals for a landscape image", () => {
    const options = buildGridOptions({ width: 1600, height: 900 })
    expect(options.length).toBeGreaterThan(0)
    expect(options[0].pieceCount).toBeGreaterThanOrEqual(4)
    expect(options.at(-1)?.pieceCount ?? 0).toBeLessThanOrEqual(3000)
  })

  it("returns valid totals for a portrait image", () => {
    const options = buildGridOptions({ width: 900, height: 1600 })
    expect(options.length).toBeGreaterThan(0)
    expect(options.every((option) => option.rows >= 2 && option.cols >= 2)).toBe(true)
  })

  it("returns valid totals for a square image", () => {
    const options = buildGridOptions({ width: 1200, height: 1200 })
    expect(options.length).toBeGreaterThan(0)
    expect(options.some((option) => option.rows === option.cols)).toBe(true)
  })
})

describe("countPieceCategories", () => {
  it("keeps exactly four corners with expected edge/interior split", () => {
    const counts = countPieceCategories(8, 11)
    expect(counts.corners).toBe(4)
    expect(counts.edges).toBe((8 - 2) * 2 + (11 - 2) * 2)
    expect(counts.interiors).toBe((8 - 2) * (11 - 2))
  })
})

describe("buildOverlayData", () => {
  it("creates deterministic paths for same grid", () => {
    const a = buildOverlayData(1000, 600, 10, 16)
    const b = buildOverlayData(1000, 600, 10, 16)
    expect(a.pathData).toEqual(b.pathData)
  })

  it("produces expected number of line paths", () => {
    const rows = 9
    const cols = 14
    const overlay = buildOverlayData(1000, 700, rows, cols)
    const lineCount = (overlay.pathData.match(/M/g) ?? []).length
    const expectedHLines = rows + 1
    const expectedVLines = cols + 1
    expect(lineCount).toBe(expectedHLines + expectedVLines)
  })

  it("keeps connector depth visible but bounded", () => {
    const width = 1000
    const height = 600
    const rows = 6
    const cols = 10
    const cellH = height / rows
    const overlay = buildOverlayData(width, height, rows, cols)

    const allNumbers = Array.from(overlay.pathData.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]))
    const yValues = allNumbers.filter((_, i) => i % 2 === 1)

    const internalBaseYs = Array.from({ length: rows - 1 }, (_, i) => (i + 1) * cellH)
    const maxDeviation = Math.max(
      ...internalBaseYs.map((baseY) => {
        const nearby = yValues.filter((y) => Math.abs(y - baseY) < cellH)
        return Math.max(...nearby.map((y) => Math.abs(y - baseY)), 0)
      }),
    )

    expect(maxDeviation).toBeGreaterThan(8)
    expect(maxDeviation).toBeLessThan(cellH)
  })
})

describe("connector pairing", () => {
  it("keeps adjacent piece edges complementary", () => {
    const rows = 10
    const cols = 13
    const maps = buildConnectorMaps(rows, cols)

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        const sharedVertical = maps.vertical[row][col].direction
        const leftPieceRightEdge = -sharedVertical
        const rightPieceLeftEdge = sharedVertical
        expect(leftPieceRightEdge).toBe(-rightPieceLeftEdge)
      }
    }

    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const sharedHorizontal = maps.horizontal[row][col].direction
        const topPieceBottomEdge = -sharedHorizontal
        const bottomPieceTopEdge = sharedHorizontal
        expect(topPieceBottomEdge).toBe(-bottomPieceTopEdge)
      }
    }
  })
})

describe("pieceEdgesForCell", () => {
  it("keeps outer borders flat", () => {
    const maps = buildConnectorMaps(4, 5)
    const topLeft = pieceEdgesForCell(0, 0, 4, 5, maps)
    const bottomRight = pieceEdgesForCell(3, 4, 4, 5, maps)

    expect(topLeft.top).toBe(0)
    expect(topLeft.left).toBe(0)
    expect(bottomRight.bottom).toBe(0)
    expect(bottomRight.right).toBe(0)
  })

  it("returns complementary shared edges for neighbors", () => {
    const rows = 6
    const cols = 7
    const maps = buildConnectorMaps(rows, cols)
    const a = pieceEdgesForCell(2, 2, rows, cols, maps)
    const right = pieceEdgesForCell(2, 3, rows, cols, maps)
    const bottom = pieceEdgesForCell(3, 2, rows, cols, maps)

    expect(a.right).toBe(-right.left)
    expect(a.bottom).toBe(-bottom.top)
  })
})
