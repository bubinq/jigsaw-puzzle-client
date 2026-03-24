import { describe, expect, it } from "vitest"
import type { PieceGroup, PuzzlePiece } from "@/lib/puzzle-game"
import {
  arePiecesMatching,
  bringGroupToFront,
  buildPlaygroundSolvedBoardRect,
  buildPuzzlePieces,
  buildSolvedBoardRect,
  clampGroupPositionWithinPlayground,
  createSinglePieceGroups,
  deriveGridForPieceCount,
  findMergeCandidate,
  getPieceNeighborDirection,
  getPieceWorldPosition,
  isPuzzleSolved,
  listAdjacentPairs,
  mergeGroups,
  pieceImageDrawRect,
  randomizePiecePositions,
  syncPiecePositionsFromGroups,
} from "@/lib/puzzle-game"

function pathBounds(pathData: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const values: Array<number> = []
  const commandRegex = /[MLC]\s*([^MLCZ]+)/g
  for (const match of pathData.matchAll(commandRegex)) {
    const numbers = (match[1].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    values.push(...numbers)
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let i = 0; i < values.length; i += 2) {
    const x = values[i]
    const y = values[i + 1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

function renderBoundsAt(
  group: PieceGroup,
  piecesById: Map<string, PuzzlePiece>,
  left: number,
  top: number,
  predicate: (piece: PuzzlePiece) => boolean = () => true
): { left: number; top: number; width: number; height: number } {
  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY

  for (const member of group.members) {
    const piece = piecesById.get(member.pieceId)
    if (!piece || !predicate(piece)) continue
    const pieceLeft = left + member.offsetLeft + piece.renderOffsetX
    const pieceTop = top + member.offsetTop + piece.renderOffsetY
    minLeft = Math.min(minLeft, pieceLeft)
    minTop = Math.min(minTop, pieceTop)
    maxRight = Math.max(maxRight, pieceLeft + piece.renderWidth)
    maxBottom = Math.max(maxBottom, pieceTop + piece.renderHeight)
  }

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  }
}

function buildGroupFromPieces(pieces: Array<PuzzlePiece>): PieceGroup {
  const anchor = pieces[0]
  return {
    id: "g1",
    left: 0,
    top: 0,
    stackOrder: 0,
    members: pieces.map((piece) => ({
      pieceId: piece.id,
      offsetLeft: piece.solvedLeft - anchor.solvedLeft,
      offsetTop: piece.solvedTop - anchor.solvedTop,
    })),
  }
}

describe("deriveGridForPieceCount", () => {
  it("returns factors that multiply to pieceCount", () => {
    const grid = deriveGridForPieceCount(96, 1600, 900)
    expect(grid.rows * grid.cols).toBe(96)
    expect(grid.rows).toBeGreaterThanOrEqual(2)
    expect(grid.cols).toBeGreaterThanOrEqual(2)
  })
})

describe("piece builders", () => {
  it("builds a centered solved board within the playground target ratios", () => {
    const board = buildPlaygroundSolvedBoardRect(
      { left: 0, top: 0, width: 1000, height: 600 },
      1600,
      900
    )

    expect(board.width).toBe(600)
    expect(board.height).toBe(337)
    expect(board.left).toBe(200)
    expect(board.top).toBe(131)
  })

  it("builds expected piece count and solved positions", () => {
    const board = buildSolvedBoardRect(1600, 900, 640, 420)
    const pieces = buildPuzzlePieces(8, 12, { ...board, left: 100, top: 80 })
    expect(pieces).toHaveLength(96)
    expect(pieces[0].solvedLeft).toBe(100)
    expect(pieces[0].solvedTop).toBe(80)
    expect(pieces.at(-1)?.row).toBe(7)
    expect(pieces.at(-1)?.col).toBe(11)
    expect(pieces[0].pathData.length).toBeGreaterThan(20)
    expect(pieces[0].renderWidth).toBeGreaterThanOrEqual(pieces[0].width)
    expect(pieces[0].renderHeight).toBeGreaterThanOrEqual(pieces[0].height)
    expect(pieces[0].renderKey).toContain("8:12:0:0")
    expect(pieces[0].sourceCropWidth).toBeCloseTo(pieces[0].renderWidth, 3)
    expect(pieces[0].sourceCropHeight).toBeCloseTo(pieces[0].renderHeight, 3)
  })

  it("keeps neighboring piece edges complementary", () => {
    const pieces = buildPuzzlePieces(5, 6, { left: 0, top: 0, width: 600, height: 500 })
    const byCell = new Map(pieces.map((piece) => [`${piece.row}:${piece.col}`, piece]))
    const center = byCell.get("2:2")
    const right = byCell.get("2:3")
    const bottom = byCell.get("3:2")
    expect(center).toBeDefined()
    expect(right).toBeDefined()
    expect(bottom).toBeDefined()
    if (!center || !right || !bottom) return

    expect(center.edges.right).toBe(-right.edges.left)
    expect(center.edges.bottom).toBe(-bottom.edges.top)
  })

  it("randomizes pieces within playground bounds deterministically", () => {
    const board = { left: 200, top: 120, width: 500, height: 320 }
    const pieces = buildPuzzlePieces(4, 5, board)
    const randomA = randomizePiecePositions(pieces, { left: 0, top: 0, width: 960, height: 600 }, 42)
    const randomB = randomizePiecePositions(pieces, { left: 0, top: 0, width: 960, height: 600 }, 42)
    expect(randomA).toEqual(randomB)
    expect(
      randomA.every(
        (piece) =>
          piece.left >= 0 &&
          piece.top >= 0 &&
          piece.left + piece.width <= 960 &&
          piece.top + piece.height <= 600
      )
    ).toBe(true)
  })

  it("creates one group per piece with zero offsets", () => {
    const pieces = buildPuzzlePieces(3, 3, { left: 0, top: 0, width: 300, height: 300 })
    const groups = createSinglePieceGroups(pieces)
    expect(groups).toHaveLength(pieces.length)
    expect(groups.every((group) => group.members.length === 1)).toBe(true)
    expect(groups.every((group) => group.members[0].offsetLeft === 0 && group.members[0].offsetTop === 0)).toBe(true)
  })

  it("derives image draw rect from piece image offsets", () => {
    const board = { left: 210, top: 150, width: 620, height: 413 }
    const pieces = buildPuzzlePieces(4, 5, board)
    const piece = pieces[7]
    const rect = pieceImageDrawRect(piece, board)
    expect(rect.left).toBe(piece.imageOffsetX)
    expect(rect.top).toBe(piece.imageOffsetY)
    expect(rect.width).toBe(board.width)
    expect(rect.height).toBe(board.height)
  })

  it("builds deterministic contour metadata for the same grid", () => {
    const board = { left: 40, top: 30, width: 640, height: 420 }
    const a = buildPuzzlePieces(6, 9, board)
    const b = buildPuzzlePieces(6, 9, board)
    expect(a).toHaveLength(b.length)
    expect(a[18].pathData).toEqual(b[18].pathData)
    expect(a[18].renderKey).toEqual(b[18].renderKey)
    expect(a[18].sourceCropLeft).toBeCloseTo(b[18].sourceCropLeft, 4)
    expect(a[18].sourceCropTop).toBeCloseTo(b[18].sourceCropTop, 4)
  })

  it("keeps generated piece paths within their render bounds", () => {
    const pieces = buildPuzzlePieces(7, 11, { left: 0, top: 0, width: 1100, height: 700 })
    for (const piece of pieces) {
      const bounds = pathBounds(piece.pathData)
      expect(bounds.minX).toBeGreaterThanOrEqual(-0.001)
      expect(bounds.minY).toBeGreaterThanOrEqual(-0.001)
      expect(bounds.maxX).toBeLessThanOrEqual(piece.renderWidth + 0.001)
      expect(bounds.maxY).toBeLessThanOrEqual(piece.renderHeight + 0.001)
    }
  })
})

describe("matching helpers", () => {
  it("matches adjacent pieces when within threshold", () => {
    const [a, b] = buildPuzzlePieces(2, 2, { left: 0, top: 0, width: 200, height: 200 })
    const movedA = { ...a, left: 300, top: 220 }
    const movedB = { ...b, left: 402, top: 221 }

    expect(arePiecesMatching(movedA, movedB, 3)).toBe(true)
    expect(arePiecesMatching(movedA, movedB, 1)).toBe(false)
  })

  it("ignores non-adjacent pieces", () => {
    const pieces = buildPuzzlePieces(3, 3, { left: 0, top: 0, width: 300, height: 300 })
    expect(arePiecesMatching(pieces[0], pieces[8], 10)).toBe(false)
  })

  it("lists horizontal and vertical neighboring pairs once", () => {
    const pieces = buildPuzzlePieces(3, 4, { left: 0, top: 0, width: 400, height: 300 })
    const pairs = listAdjacentPairs(pieces)
    expect(pairs).toHaveLength((4 - 1) * 3 + (3 - 1) * 4)
  })

  it("reports solved only when all adjacent pairs match", () => {
    const solved = buildPuzzlePieces(2, 3, { left: 50, top: 40, width: 300, height: 200 })
    expect(isPuzzleSolved(solved, 0.5)).toBe(true)

    const unsolved = solved.map((piece, index) =>
      index === 0 ? { ...piece, left: piece.left + 40 } : piece
    )
    expect(isPuzzleSolved(unsolved, 0.5)).toBe(false)
  })

  it("matches vertical neighbors when within threshold", () => {
    const pieces = buildPuzzlePieces(2, 2, { left: 0, top: 0, width: 200, height: 200 })
    const top = pieces[0]
    const bottom = pieces[2]
    const movedTop = { ...top, left: 100, top: 50 }
    const movedBottom = { ...bottom, left: 101, top: 150 }
    expect(arePiecesMatching(movedTop, movedBottom, 3)).toBe(true)
    expect(arePiecesMatching(movedTop, movedBottom, 0.5)).toBe(false)
  })

  it("never matches diagonal neighbors", () => {
    const pieces = buildPuzzlePieces(3, 3, { left: 0, top: 0, width: 300, height: 300 })
    const topLeft = pieces[0]
    const bottomRight = pieces[8]
    expect(getPieceNeighborDirection(topLeft, bottomRight)).toBe(null)
    const placedTL = { ...topLeft, left: 100, top: 100 }
    const placedBR = { ...bottomRight, left: 200, top: 200 }
    expect(arePiecesMatching(placedTL, placedBR, 1000)).toBe(false)
  })
})

describe("group merge helpers", () => {
  it("getPieceWorldPosition returns group left/top plus member offset", () => {
    const group = {
      id: "g1",
      left: 100,
      top: 80,
      stackOrder: 0,
      members: [{ pieceId: "p1", offsetLeft: 20, offsetTop: 10 }],
    }
    const pos = getPieceWorldPosition(group, group.members[0])
    expect(pos).toEqual({ left: 120, top: 90 })
  })

  it("syncPiecePositionsFromGroups updates piece left/top from group and member", () => {
    const pieces = buildPuzzlePieces(2, 2, { left: 0, top: 0, width: 200, height: 200 })
    const groups = createSinglePieceGroups(pieces)
    groups[0].left = 300
    groups[0].top = 200
    pieces[0].groupId = groups[0].id
    const synced = syncPiecePositionsFromGroups(pieces, groups)
    expect(synced[0].left).toBe(300)
    expect(synced[0].top).toBe(200)
  })

  it("findMergeCandidate returns snap when horizontal neighbors match", () => {
    const board = { left: 0, top: 0, width: 200, height: 200 }
    const pieces = buildPuzzlePieces(2, 2, board)
    const [a, b] = pieces
    const groups = [
      {
        id: "ga",
        left: 100,
        top: 50,
        stackOrder: 1,
        members: [{ pieceId: a.id, offsetLeft: 0, offsetTop: 0 }],
      },
      {
        id: "gb",
        left: 200,
        top: 51,
        stackOrder: 2,
        members: [{ pieceId: b.id, offsetLeft: 0, offsetTop: 0 }],
      },
    ]
    const piecesWithGroups = pieces.map((p) =>
      p.id === a.id ? { ...p, groupId: "ga" } : { ...p, groupId: "gb" }
    )
    const candidate = findMergeCandidate("ga", 100, 50, groups, piecesWithGroups, 6)
    expect(candidate).toBeDefined()
    expect(candidate?.targetGroupId).toBe("gb")
  })

  it("findMergeCandidate returns null when pieces do not match", () => {
    const board = { left: 0, top: 0, width: 200, height: 200 }
    const pieces = buildPuzzlePieces(2, 2, board)
    const [a, b] = pieces
    const groups = [
      {
        id: "ga",
        left: 100,
        top: 50,
        stackOrder: 1,
        members: [{ pieceId: a.id, offsetLeft: 0, offsetTop: 0 }],
      },
      {
        id: "gb",
        left: 250,
        top: 50,
        stackOrder: 2,
        members: [{ pieceId: b.id, offsetLeft: 0, offsetTop: 0 }],
      },
    ]
    const piecesWithGroups = pieces.map((p) =>
      p.id === a.id ? { ...p, groupId: "ga" } : { ...p, groupId: "gb" }
    )
    const candidate = findMergeCandidate("ga", 100, 50, groups, piecesWithGroups, 6)
    expect(candidate).toBe(null)
  })

  it("findMergeCandidate returns null for diagonal neighbors", () => {
    const pieces = buildPuzzlePieces(3, 3, { left: 0, top: 0, width: 300, height: 300 })
    const topLeft = pieces[0]
    const bottomRight = pieces[8]
    const groups = [
      {
        id: "ga",
        left: 50,
        top: 50,
        stackOrder: 1,
        members: [{ pieceId: topLeft.id, offsetLeft: 0, offsetTop: 0 }],
      },
      {
        id: "gb",
        left: 150,
        top: 150,
        stackOrder: 2,
        members: [{ pieceId: bottomRight.id, offsetLeft: 0, offsetTop: 0 }],
      },
    ]
    const piecesWithGroups = pieces.map((p) =>
      p.id === topLeft.id ? { ...p, groupId: "ga" } : p.id === bottomRight.id ? { ...p, groupId: "gb" } : p
    )
    const candidate = findMergeCandidate("ga", 50, 50, groups, piecesWithGroups, 100)
    expect(candidate).toBe(null)
  })

  it("mergeGroups combines two groups and syncs piece positions", () => {
    const board = { left: 0, top: 0, width: 200, height: 200 }
    const pieces = buildPuzzlePieces(2, 2, board)
    const [a, b] = pieces
    const groups = [
      {
        id: "ga",
        left: 98,
        top: 50,
        stackOrder: 5,
        members: [{ pieceId: a.id, offsetLeft: 0, offsetTop: 0 }],
      },
      {
        id: "gb",
        left: 200,
        top: 50,
        stackOrder: 7,
        members: [{ pieceId: b.id, offsetLeft: 0, offsetTop: 0 }],
      },
    ]
    const piecesWithGroups = pieces.map((p) =>
      p.id === a.id ? { ...p, groupId: "ga" } : { ...p, groupId: "gb" }
    )
    const { groups: nextGroups, pieces: nextPieces } = mergeGroups(
      groups,
      piecesWithGroups,
      "ga",
      "gb",
      100,
      50
    )
    expect(nextGroups).toHaveLength(1)
    expect(nextGroups[0].members).toHaveLength(2)
    expect(nextGroups[0].stackOrder).toBe(7)
    expect(nextPieces.every((p) => p.groupId === "gb")).toBe(true)
    const pieceA = nextPieces.find((p) => p.id === a.id)
    const pieceB = nextPieces.find((p) => p.id === b.id)
    expect(pieceA?.left).toBe(100)
    expect(pieceA?.top).toBe(50)
    expect(pieceB?.left).toBe(200)
    expect(pieceB?.top).toBe(50)
  })

  it("bringGroupToFront bumps only selected group stack order", () => {
    const groups = [
      { id: "g1", left: 10, top: 20, stackOrder: 1, members: [] },
      { id: "g2", left: 30, top: 40, stackOrder: 4, members: [] },
    ]
    const next = bringGroupToFront(groups, "g1")
    expect(next.find((g) => g.id === "g1")?.stackOrder).toBe(5)
    expect(next.find((g) => g.id === "g2")?.stackOrder).toBe(4)
  })

  it("keeps a single piece past the left border until half of it crosses", () => {
    const board = { left: 0, top: 0, width: 200, height: 100 }
    const [piece] = buildPuzzlePieces(2, 2, board)
    const group = {
      id: "g1",
      left: 0,
      top: 0,
      stackOrder: 0,
      members: [{ pieceId: piece.id, offsetLeft: 0, offsetTop: 0 }],
    }
    const piecesById = new Map([[piece.id, piece]])
    const playground = { left: 0, top: 0, width: 220, height: 120 }

    const justBeforeThresholdLeft =
      playground.left - (piece.renderOffsetX + piece.renderWidth / 2) + 1
    const justBeforeThreshold = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      justBeforeThresholdLeft,
      0,
      playground
    )
    expect(justBeforeThreshold.left).toBeCloseTo(justBeforeThresholdLeft, 5)

    const thresholdLeft =
      playground.left - (piece.renderOffsetX + piece.renderWidth / 2)
    const snapped = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      thresholdLeft,
      0,
      playground
    )
    expect(snapped.left).toBeCloseTo(playground.left - piece.renderOffsetX, 5)
  })

  it("keeps a single piece past the top border until half of it crosses", () => {
    const board = { left: 0, top: 0, width: 200, height: 100 }
    const [piece] = buildPuzzlePieces(2, 2, board)
    const group = {
      id: "g1",
      left: 0,
      top: 0,
      stackOrder: 0,
      members: [{ pieceId: piece.id, offsetLeft: 0, offsetTop: 0 }],
    }
    const piecesById = new Map([[piece.id, piece]])
    const playground = { left: 0, top: 0, width: 220, height: 120 }

    const justBeforeThresholdTop =
      playground.top - (piece.renderOffsetY + piece.renderHeight / 2) + 1
    const justBeforeThreshold = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      0,
      justBeforeThresholdTop,
      playground
    )
    expect(justBeforeThreshold.top).toBeCloseTo(justBeforeThresholdTop, 5)

    const thresholdTop =
      playground.top - (piece.renderOffsetY + piece.renderHeight / 2)
    const snapped = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      0,
      thresholdTop,
      playground
    )
    expect(snapped.top).toBeCloseTo(playground.top - piece.renderOffsetY, 5)
  })

  it("snaps a top-overflowing group by its bottom row only", () => {
    const pieces = buildPuzzlePieces(2, 2, { left: 0, top: 0, width: 200, height: 200 })
    const group = buildGroupFromPieces(pieces)
    const piecesById = new Map(pieces.map((piece) => [piece.id, piece] as const))
    const playground = { left: 0, top: 0, width: 220, height: 220 }
    const bottomRowBounds = renderBoundsAt(group, piecesById, 0, 0, (piece) => piece.row === 1)

    const droppedTop =
      playground.top - (bottomRowBounds.top + bottomRowBounds.height / 2)
    const next = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      0,
      droppedTop,
      playground
    )
    const snappedBottomRow = renderBoundsAt(
      group,
      piecesById,
      next.left,
      next.top,
      (piece) => piece.row === 1
    )
    const topRow = renderBoundsAt(
      group,
      piecesById,
      next.left,
      next.top,
      (piece) => piece.row === 0
    )

    expect(snappedBottomRow.top).toBeCloseTo(playground.top, 5)
    expect(topRow.top).toBeLessThan(playground.top)
  })

  it("snaps a bottom-overflowing group by its top row only", () => {
    const pieces = buildPuzzlePieces(2, 2, { left: 0, top: 0, width: 200, height: 200 })
    const group = buildGroupFromPieces(pieces)
    const piecesById = new Map(pieces.map((piece) => [piece.id, piece] as const))
    const playground = { left: 0, top: 0, width: 220, height: 220 }
    const topRowBounds = renderBoundsAt(group, piecesById, 0, 0, (piece) => piece.row === 0)
    const playgroundBottom = playground.top + playground.height

    const droppedTop =
      playgroundBottom - (topRowBounds.top + topRowBounds.height / 2)
    const next = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      0,
      droppedTop,
      playground
    )
    const snappedTopRow = renderBoundsAt(
      group,
      piecesById,
      next.left,
      next.top,
      (piece) => piece.row === 0
    )
    const bottomRow = renderBoundsAt(
      group,
      piecesById,
      next.left,
      next.top,
      (piece) => piece.row === 1
    )

    expect(snappedTopRow.top + snappedTopRow.height).toBeCloseTo(playgroundBottom, 5)
    expect(bottomRow.top + bottomRow.height).toBeGreaterThan(playgroundBottom)
  })

  it("snaps a sideways-overflowing group by the opposite edge column only", () => {
    const pieces = buildPuzzlePieces(2, 2, { left: 0, top: 0, width: 200, height: 200 })
    const group = buildGroupFromPieces(pieces)
    const piecesById = new Map(pieces.map((piece) => [piece.id, piece] as const))
    const playground = { left: 0, top: 0, width: 220, height: 220 }
    const playgroundRight = playground.left + playground.width
    const rightColumnBounds = renderBoundsAt(group, piecesById, 0, 0, (piece) => piece.col === 1)
    const leftColumnBounds = renderBoundsAt(group, piecesById, 0, 0, (piece) => piece.col === 0)

    const leftDropped =
      playground.left - (rightColumnBounds.left + rightColumnBounds.width / 2)
    const leftSnapped = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      leftDropped,
      0,
      playground
    )
    const snappedRightColumn = renderBoundsAt(
      group,
      piecesById,
      leftSnapped.left,
      leftSnapped.top,
      (piece) => piece.col === 1
    )
    const remainingLeftColumn = renderBoundsAt(
      group,
      piecesById,
      leftSnapped.left,
      leftSnapped.top,
      (piece) => piece.col === 0
    )
    expect(snappedRightColumn.left).toBeCloseTo(playground.left, 5)
    expect(remainingLeftColumn.left).toBeLessThan(playground.left)

    const rightDropped =
      playgroundRight - (leftColumnBounds.left + leftColumnBounds.width / 2)
    const rightSnapped = clampGroupPositionWithinPlayground(
      group,
      piecesById,
      rightDropped,
      0,
      playground
    )
    const snappedLeftColumn = renderBoundsAt(
      group,
      piecesById,
      rightSnapped.left,
      rightSnapped.top,
      (piece) => piece.col === 0
    )
    const remainingRightColumn = renderBoundsAt(
      group,
      piecesById,
      rightSnapped.left,
      rightSnapped.top,
      (piece) => piece.col === 1
    )
    expect(snappedLeftColumn.left + snappedLeftColumn.width).toBeCloseTo(
      playgroundRight,
      5
    )
    expect(remainingRightColumn.left + remainingRightColumn.width).toBeGreaterThan(
      playgroundRight
    )
  })
})
