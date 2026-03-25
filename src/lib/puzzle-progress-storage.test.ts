import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PieceGroup } from "@/lib/puzzle-game"
import type { PuzzleProgressSnapshot } from "@/lib/puzzle-progress-storage"
import {
  clearPuzzleProgress,
  decodePuzzleProgress,
  encodePuzzleProgress,
  isPuzzleProgressCompatible,
  readPuzzleProgress,
  scalePuzzleProgressGroups,
  writePuzzleProgress,
} from "@/lib/puzzle-progress-storage"

const TEST_PUZZLE_ID = "puzzle-42"

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function buildGroups(): Array<PieceGroup> {
  return [
    {
      id: "group-a",
      left: 123.4,
      top: 56.8,
      stackOrder: 3.2,
      members: [
        { pieceId: "piece-0", offsetLeft: 0, offsetTop: 0 },
        { pieceId: "piece-1", offsetLeft: 51.2, offsetTop: -1.7 },
      ],
    },
    {
      id: "group-b",
      left: 301.6,
      top: 222.5,
      stackOrder: 8.9,
      members: [{ pieceId: "piece-2", offsetLeft: 0, offsetTop: 0 }],
    },
  ]
}

function buildSnapshot(): PuzzleProgressSnapshot {
  return {
    solved: false,
    geometry: {
      boardWidth: 601.4,
      boardHeight: 338.6,
      playgroundWidth: 1199.9,
      playgroundHeight: 700.2,
    },
    groups: buildGroups(),
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage())
})

afterEach(() => {
  clearPuzzleProgress(TEST_PUZZLE_ID)
  vi.unstubAllGlobals()
})

describe("puzzle-progress-storage codec", () => {
  it("encodes and decodes a progress snapshot", () => {
    const encoded = encodePuzzleProgress(buildSnapshot())
    const decoded = decodePuzzleProgress(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded?.solved).toBe(false)
    expect(decoded?.geometry).toEqual({
      boardWidth: 601,
      boardHeight: 339,
      playgroundWidth: 1200,
      playgroundHeight: 700,
    })
    expect(decoded?.groups[0]).toMatchObject({
      id: "group-a",
      left: 123.4,
      top: 56.8,
      stackOrder: 3,
    })
    expect(decoded?.groups[0].members[1]).toEqual({
      pieceId: "piece-1",
      offsetLeft: 51.2,
      offsetTop: -1.7,
    })
  })

  it("returns null for invalid payloads", () => {
    expect(decodePuzzleProgress("not-json")).toBeNull()
    expect(decodePuzzleProgress(JSON.stringify({ v: 999, s: 0, d: [1, 1, 1, 1], g: [] }))).toBeNull()
    expect(decodePuzzleProgress(JSON.stringify({ v: 1, s: 1, d: [1, 1], g: [] }))).toBeNull()
  })
})

describe("puzzle-progress-storage localStorage", () => {
  it("writes, reads, and clears puzzle progress", () => {
    const snapshot = buildSnapshot()
    writePuzzleProgress(TEST_PUZZLE_ID, snapshot)

    const loaded = readPuzzleProgress(TEST_PUZZLE_ID)
    expect(loaded).not.toBeNull()
    expect(loaded?.groups).toHaveLength(2)

    clearPuzzleProgress(TEST_PUZZLE_ID)
    expect(readPuzzleProgress(TEST_PUZZLE_ID)).toBeNull()
  })
})

describe("isPuzzleProgressCompatible", () => {
  it("matches rounded geometry values", () => {
    const snapshot = buildSnapshot()
    const compatible = isPuzzleProgressCompatible(snapshot, {
      boardWidth: 601,
      boardHeight: 339,
      playgroundWidth: 1200,
      playgroundHeight: 700,
    })
    expect(compatible).toBe(true)
  })

  it("rejects incompatible geometry", () => {
    const snapshot = buildSnapshot()
    const compatible = isPuzzleProgressCompatible(snapshot, {
      boardWidth: 610,
      boardHeight: 339,
      playgroundWidth: 1200,
      playgroundHeight: 700,
    })
    expect(compatible).toBe(false)
  })
})

describe("scalePuzzleProgressGroups", () => {
  it("scales group positions and member offsets between geometries", () => {
    const groups = buildGroups()
    const scaled = scalePuzzleProgressGroups(
      groups,
      {
        boardWidth: 600,
        boardHeight: 300,
        playgroundWidth: 1200,
        playgroundHeight: 600,
      },
      {
        boardWidth: 900,
        boardHeight: 450,
        playgroundWidth: 1800,
        playgroundHeight: 900,
      }
    )

    expect(scaled[0]?.id).toBe("group-a")
    expect(scaled[0]?.left).toBeCloseTo(185.1, 6)
    expect(scaled[0]?.top).toBeCloseTo(85.2, 6)
    expect(scaled[0]?.members[1]?.pieceId).toBe("piece-1")
    expect(scaled[0]?.members[1]?.offsetLeft).toBeCloseTo(76.8, 6)
    expect(scaled[0]?.members[1]?.offsetTop).toBeCloseTo(-2.55, 6)
    expect(scaled[1]?.id).toBe("group-b")
    expect(scaled[1]?.left).toBeCloseTo(452.4, 6)
    expect(scaled[1]?.top).toBeCloseTo(333.75, 6)
  })

  it("preserves values when geometry is unchanged", () => {
    const groups = buildGroups()
    const geometry = {
      boardWidth: 601,
      boardHeight: 339,
      playgroundWidth: 1200,
      playgroundHeight: 700,
    }
    const scaled = scalePuzzleProgressGroups(groups, geometry, geometry)
    expect(scaled).toEqual([
      {
        id: "group-a",
        left: 123.4,
        top: 56.8,
        stackOrder: 3.2,
        members: [
          { pieceId: "piece-0", offsetLeft: 0, offsetTop: 0 },
          { pieceId: "piece-1", offsetLeft: 51.2, offsetTop: -1.7 },
        ],
      },
      {
        id: "group-b",
        left: 301.6,
        top: 222.5,
        stackOrder: 8.9,
        members: [{ pieceId: "piece-2", offsetLeft: 0, offsetTop: 0 }],
      },
    ])
  })
})
