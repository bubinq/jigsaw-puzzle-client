

import type { EdgeDirection, PieceEdges } from "@/lib/puzzle-preview"
import { buildConnectorMaps, pieceEdgesForCell } from "@/lib/puzzle-preview"

export type Point = {
  x: number
  y: number
}

export type Rect = {
  left: number
  top: number
  width: number
  height: number
}

const SOLVED_BOARD_WIDTH_RATIO = 0.6
const SOLVED_BOARD_HEIGHT_RATIO = 0.9

export type PuzzleGameImage = {
  src: string
  width: number
  height: number
}

export type PuzzlePiece = {
  id: string
  index: number
  row: number
  col: number
  width: number
  height: number
  solvedLeft: number
  solvedTop: number
  left: number
  top: number
  groupId: string
  edges: PieceEdges
  renderWidth: number
  renderHeight: number
  renderOffsetX: number
  renderOffsetY: number
  imageOffsetX: number
  imageOffsetY: number
  pathData: string
  renderKey: string
  sourceCropLeft: number
  sourceCropTop: number
  sourceCropWidth: number
  sourceCropHeight: number
}

export type GroupMember = {
  pieceId: string
  offsetLeft: number
  offsetTop: number
}

export type PieceGroup = {
  id: string
  left: number
  top: number
  stackOrder: number
  members: Array<GroupMember>
}

export type NeighborDirection = "left" | "right" | "top" | "bottom"

export type AdjacentPair = {
  fromId: string
  toId: string
  direction: NeighborDirection
}

export type RelativeDelta = {
  dx: number
  dy: number
}

export type PieceImageDrawRect = {
  left: number
  top: number
  width: number
  height: number
}

type EdgeProfile = {
  neckStart: number
  neckEnd: number
  shoulderPull: number
  headPull: number
  ampScale: number
}

type EdgeProfileMaps = {
  horizontal: Array<Array<EdgeProfile>>
  vertical: Array<Array<EdgeProfile>>
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function decodeImageMetaFromUrl(url: string): Promise<PuzzleGameImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        src: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }
    img.onerror = () => reject(new Error("invalid_image"))
    img.src = url
  })
}

export function deriveGridForPieceCount(
  pieceCount: number,
  imageWidth: number,
  imageHeight: number
): { rows: number; cols: number } {
  const safeCount = Math.max(4, Math.floor(pieceCount))
  const targetAspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1

  let bestRows = 2
  let bestCols = Math.max(2, safeCount / 2)
  let bestScore = Number.POSITIVE_INFINITY


  for (let rows = 2; rows <= safeCount; rows += 1) {
    if (safeCount % rows !== 0) continue
    const cols = safeCount / rows
    if (cols < 2) continue
    const gridAspect = cols / rows
    const score = Math.abs(Math.log(gridAspect / targetAspect))
    if (score < bestScore) {
      bestScore = score
      bestRows = rows
      bestCols = cols
    }
  }

  return { rows: bestRows, cols: bestCols }
}

export function buildSolvedBoardRect(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number
): Rect {
  const safeMaxWidth = Math.max(100, maxWidth)
  const safeMaxHeight = Math.max(100, maxHeight)
  const widthRatio = safeMaxWidth / Math.max(1, imageWidth)
  const heightRatio = safeMaxHeight / Math.max(1, imageHeight)
  const scale = Math.min(widthRatio, heightRatio)

  const width = Math.max(80, Math.floor(imageWidth * scale))
  const height = Math.max(80, Math.floor(imageHeight * scale))

  return {
    left: 0,
    top: 0,
    width,
    height,
  }
}

export function buildPlaygroundSolvedBoardRect(
  playgroundRect: Rect,
  imageWidth: number,
  imageHeight: number
): Rect {
  const solvedBoardSize = buildSolvedBoardRect(
    imageWidth,
    imageHeight,
    playgroundRect.width * SOLVED_BOARD_WIDTH_RATIO,
    playgroundRect.height * SOLVED_BOARD_HEIGHT_RATIO
  )

  return {
    left: playgroundRect.left + Math.floor((playgroundRect.width - solvedBoardSize.width) / 2),
    top: playgroundRect.top + Math.floor((playgroundRect.height - solvedBoardSize.height) / 2),
    width: solvedBoardSize.width,
    height: solvedBoardSize.height,
  }
}

export function buildPuzzlePieces(
  rows: number,
  cols: number,
  boardRect: Rect
): Array<PuzzlePiece> {
  const safeRows = Math.max(2, rows)
  const safeCols = Math.max(2, cols)
  const pieceWidth = boardRect.width / safeCols
  const pieceHeight = boardRect.height / safeRows
  const tabDepth = Math.min(pieceWidth, pieceHeight) * 0.22
  const connectors = buildConnectorMaps(safeRows, safeCols)
  const edgeProfiles = buildEdgeProfileMaps(safeRows, safeCols)
  const pieces: Array<PuzzlePiece> = []

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      const index = row * safeCols + col
      const id = `piece-${index}`
      const solvedLeft = boardRect.left + col * pieceWidth
      const solvedTop = boardRect.top + row * pieceHeight
      const edges = pieceEdgesForCell(row, col, safeRows, safeCols, connectors)
      const profiles = edgeProfilesForPiece(row, col, safeRows, safeCols, edgeProfiles)
      const leftInset = edgeOutwardInset("left", edges.left, profiles.left, tabDepth, pieceWidth, pieceHeight)
      const rightInset = edgeOutwardInset("right", edges.right, profiles.right, tabDepth, pieceWidth, pieceHeight)
      const topInset = edgeOutwardInset("top", edges.top, profiles.top, tabDepth, pieceWidth, pieceHeight)
      const bottomInset = edgeOutwardInset("bottom", edges.bottom, profiles.bottom, tabDepth, pieceWidth, pieceHeight)

      const renderWidth = pieceWidth + leftInset + rightInset
      const renderHeight = pieceHeight + topInset + bottomInset
      const renderOffsetX = -leftInset
      const renderOffsetY = -topInset
      const pathData = buildPiecePath(
        pieceWidth,
        pieceHeight,
        edges,
        tabDepth,
        leftInset,
        topInset,
        profiles
      )
      const sourceCropLeft = col * pieceWidth - leftInset
      const sourceCropTop = row * pieceHeight - topInset
      const sourceCropWidth = renderWidth
      const sourceCropHeight = renderHeight

      pieces.push({
        id,
        index,
        row,
        col,
        width: pieceWidth,
        height: pieceHeight,
        solvedLeft,
        solvedTop,
        left: solvedLeft,
        top: solvedTop,
        groupId: `group-${id}`,
        edges,
        renderWidth,
        renderHeight,
        renderOffsetX,
        renderOffsetY,
        imageOffsetX: -(col * pieceWidth - leftInset),
        imageOffsetY: -(row * pieceHeight - topInset),
        pathData,
        renderKey: `${safeRows}:${safeCols}:${row}:${col}`,
        sourceCropLeft,
        sourceCropTop,
        sourceCropWidth,
        sourceCropHeight,
      })
    }
  }

  return pieces
}

function edgeTabSign(direction: EdgeDirection): number {
  if (direction === 1) return -1 // outward
  if (direction === -1) return 1 // inward
  return 0
}

function buildPiecePath(
  cellW: number,
  cellH: number,
  edges: PieceEdges,
  tabDepth: number,
  leftInset: number,
  topInset: number,
  edgeProfiles: {
    top: EdgeProfile | null
    right: EdgeProfile | null
    bottom: EdgeProfile | null
    left: EdgeProfile | null
  }
): string {
  const x0 = leftInset
  const y0 = topInset
  const x1 = x0 + cellW
  const y1 = y0 + cellH

  const topSign = edgeTabSign(edges.top)
  const rightSign = edgeTabSign(edges.right)
  const bottomSign = edgeTabSign(edges.bottom)
  const leftSign = edgeTabSign(edges.left)

  const topProfile = edgeProfiles.top ?? defaultEdgeProfile()
  const rightProfile = edgeProfiles.right ?? defaultEdgeProfile()
  const bottomProfile = edgeProfiles.bottom ?? defaultEdgeProfile()
  const leftProfile = edgeProfiles.left ?? defaultEdgeProfile()

  const topStart = x0 + cellW * topProfile.neckStart
  const topEnd = x0 + cellW * topProfile.neckEnd
  const rightStart = y0 + cellH * rightProfile.neckStart
  const rightEnd = y0 + cellH * rightProfile.neckEnd
  const bottomStart = x0 + cellW * (1 - bottomProfile.neckStart)
  const bottomEnd = x0 + cellW * (1 - bottomProfile.neckEnd)
  const leftStart = y0 + cellH * (1 - leftProfile.neckStart)
  const leftEnd = y0 + cellH * (1 - leftProfile.neckEnd)

  const topBulge = y0 + topSign * tabDepth * topProfile.ampScale
  const rightBulge = x1 - rightSign * tabDepth * rightProfile.ampScale
  const bottomBulge = y1 - bottomSign * tabDepth * bottomProfile.ampScale
  const leftBulge = x0 + leftSign * tabDepth * leftProfile.ampScale
  const rightHeadReach = Math.min(
    cellH * rightProfile.headPull,
    tabDepth * rightProfile.ampScale * 1.05
  )
  const leftHeadReach = Math.min(
    cellH * leftProfile.headPull,
    tabDepth * leftProfile.ampScale * 1.05
  )

  return [
    `M${x0.toFixed(3)},${y0.toFixed(3)}`,
    `L${topStart.toFixed(3)},${y0.toFixed(3)}`,
    topSign === 0
      ? `L${topEnd.toFixed(3)},${y0.toFixed(3)}`
      : `C${(topStart + cellW * topProfile.shoulderPull).toFixed(3)},${y0.toFixed(3)},${(topStart - cellW * topProfile.headPull).toFixed(3)},${(y0 + topSign * tabDepth * topProfile.ampScale * 0.86).toFixed(3)},${((topStart + topEnd) / 2).toFixed(3)},${topBulge.toFixed(3)} C${(topEnd + cellW * topProfile.headPull).toFixed(3)},${(y0 + topSign * tabDepth * topProfile.ampScale * 0.86).toFixed(3)},${(topEnd - cellW * topProfile.shoulderPull).toFixed(3)},${y0.toFixed(3)},${topEnd.toFixed(3)},${y0.toFixed(3)}`,
    `L${x1.toFixed(3)},${y0.toFixed(3)}`,
    `L${x1.toFixed(3)},${rightStart.toFixed(3)}`,
    rightSign === 0
      ? `L${x1.toFixed(3)},${rightEnd.toFixed(3)}`
      : `C${x1.toFixed(3)},${(rightStart + cellH * rightProfile.shoulderPull).toFixed(3)},${(x1 - rightSign * rightHeadReach).toFixed(3)},${(rightStart - cellH * rightProfile.headPull).toFixed(3)},${rightBulge.toFixed(3)},${((rightStart + rightEnd) / 2).toFixed(3)} C${(x1 - rightSign * rightHeadReach).toFixed(3)},${(rightEnd + cellH * rightProfile.headPull).toFixed(3)},${x1.toFixed(3)},${(rightEnd - cellH * rightProfile.shoulderPull).toFixed(3)},${x1.toFixed(3)},${rightEnd.toFixed(3)}`,
    `L${x1.toFixed(3)},${y1.toFixed(3)}`,
    `L${bottomStart.toFixed(3)},${y1.toFixed(3)}`,
    bottomSign === 0
      ? `L${bottomEnd.toFixed(3)},${y1.toFixed(3)}`
      : `C${(bottomStart - cellW * bottomProfile.shoulderPull).toFixed(3)},${y1.toFixed(3)},${(bottomStart + cellW * bottomProfile.headPull).toFixed(3)},${(y1 - bottomSign * tabDepth * bottomProfile.ampScale * 0.86).toFixed(3)},${((bottomStart + bottomEnd) / 2).toFixed(3)},${bottomBulge.toFixed(3)} C${(bottomEnd - cellW * bottomProfile.headPull).toFixed(3)},${(y1 - bottomSign * tabDepth * bottomProfile.ampScale * 0.86).toFixed(3)},${(bottomEnd + cellW * bottomProfile.shoulderPull).toFixed(3)},${y1.toFixed(3)},${bottomEnd.toFixed(3)},${y1.toFixed(3)}`,
    `L${x0.toFixed(3)},${y1.toFixed(3)}`,
    `L${x0.toFixed(3)},${leftStart.toFixed(3)}`,
    leftSign === 0
      ? `L${x0.toFixed(3)},${leftEnd.toFixed(3)}`
      : `C${x0.toFixed(3)},${(leftStart - cellH * leftProfile.shoulderPull).toFixed(3)},${(x0 + leftSign * leftHeadReach).toFixed(3)},${(leftStart + cellH * leftProfile.headPull).toFixed(3)},${leftBulge.toFixed(3)},${((leftStart + leftEnd) / 2).toFixed(3)} C${(x0 + leftSign * leftHeadReach).toFixed(3)},${(leftEnd - cellH * leftProfile.headPull).toFixed(3)},${x0.toFixed(3)},${(leftEnd + cellH * leftProfile.shoulderPull).toFixed(3)},${x0.toFixed(3)},${leftEnd.toFixed(3)}`,
    "Z",
  ].join(" ")
}

function edgeOutwardInset(
  edge: "left" | "right" | "top" | "bottom",
  edgeDirection: EdgeDirection,
  profile: EdgeProfile | null,
  tabDepth: number,
  cellW: number,
  cellH: number
): number {
  if (edgeDirection !== 1) return 0
  const effective = profile ?? defaultEdgeProfile()
  const ampExtent = tabDepth * effective.ampScale
  const isVerticalEdge = edge === "left" || edge === "right"
  const shoulderExtent = isVerticalEdge
    ? cellH * effective.headPull
    : cellW * effective.headPull
  return Math.max(ampExtent, shoulderExtent)
}

function defaultEdgeProfile(): EdgeProfile {
  return {
    neckStart: 0.35,
    neckEnd: 0.65,
    shoulderPull: 0.05,
    headPull: 0.16,
    ampScale: 1,
  }
}

function edgeProfileFromSeed(seed: number): EdgeProfile {
  const random = mulberry32(seed)
  return {
    neckStart: 0.34 + random() * 0.04,
    neckEnd: 0.62 + random() * 0.04,
    shoulderPull: 0.045 + random() * 0.02,
    headPull: 0.14 + random() * 0.045,
    ampScale: 0.92 + random() * 0.18,
  }
}

function buildEdgeProfileMaps(rows: number, cols: number): EdgeProfileMaps {
  const horizontal: Array<Array<EdgeProfile>> = []
  for (let row = 0; row < rows - 1; row += 1) {
    const line: Array<EdgeProfile> = []
    for (let col = 0; col < cols; col += 1) {
      line.push(edgeProfileFromSeed(row * 7919 + col * 104729 + rows * 1613 + cols * 9973))
    }
    horizontal.push(line)
  }

  const vertical: Array<Array<EdgeProfile>> = []
  for (let row = 0; row < rows; row += 1) {
    const line: Array<EdgeProfile> = []
    for (let col = 0; col < cols - 1; col += 1) {
      line.push(edgeProfileFromSeed(row * 1543 + col * 31337 + rows * 8191 + cols * 12289))
    }
    vertical.push(line)
  }
  return { horizontal, vertical }
}

function edgeProfilesForPiece(
  row: number,
  col: number,
  rows: number,
  cols: number,
  maps: EdgeProfileMaps
): {
  top: EdgeProfile | null
  right: EdgeProfile | null
  bottom: EdgeProfile | null
  left: EdgeProfile | null
} {
  return {
    top: row > 0 ? maps.horizontal[row - 1][col] : null,
    right: col < cols - 1 ? maps.vertical[row][col] : null,
    bottom: row < rows - 1 ? maps.horizontal[row][col] : null,
    left: col > 0 ? maps.vertical[row][col - 1] : null,
  }
}

export function randomizePiecePositions(
  pieces: Array<PuzzlePiece>,
  playgroundRect: Rect,
  seed: number
): Array<PuzzlePiece> {
  const random = mulberry32(seed)
  const padding = 12
  const leftMin = playgroundRect.left + padding
  const topMin = playgroundRect.top + padding
  const leftMax = playgroundRect.left + playgroundRect.width - padding
  const topMax = playgroundRect.top + playgroundRect.height - padding

  return pieces.map((piece) => {
    const left = leftMin + random() * Math.max(1, leftMax - leftMin - piece.width)
    const top = topMin + random() * Math.max(1, topMax - topMin - piece.height)

    return {
      ...piece,
      left: clamp(left, leftMin, leftMax - piece.width),
      top: clamp(top, topMin, topMax - piece.height),
    }
  })
}

export function createSinglePieceGroups(pieces: Array<PuzzlePiece>): Array<PieceGroup> {
  return pieces.map((piece, index) => ({
    id: piece.groupId,
    left: piece.left,
    top: piece.top,
    stackOrder: index,
    members: [
      {
        pieceId: piece.id,
        offsetLeft: 0,
        offsetTop: 0,
      },
    ],
  }))
}

export function moveGroup(groups: Array<PieceGroup>, groupId: string, left: number, top: number): Array<PieceGroup> {
  return groups.map((group) => (group.id === groupId ? { ...group, left, top } : group))
}

export function bringGroupToFront(groups: Array<PieceGroup>, groupId: string): Array<PieceGroup> {
  const topOrder = groups.reduce((maxOrder, group) => Math.max(maxOrder, group.stackOrder), 0)
  return groups.map((group) =>
    group.id === groupId ? { ...group, stackOrder: topOrder + 1 } : group
  )
}

export function pieceByIdMap(pieces: Array<PuzzlePiece>): Map<string, PuzzlePiece> {
  return new Map(pieces.map((piece) => [piece.id, piece]))
}

export function pieceImageDrawRect(piece: PuzzlePiece, boardRect: Rect): PieceImageDrawRect {
  return {
    left: piece.imageOffsetX,
    top: piece.imageOffsetY,
    width: boardRect.width,
    height: boardRect.height,
  }
}

export function getPieceNeighborDirection(a: PuzzlePiece, b: PuzzlePiece): NeighborDirection | null {
  if (a.row === b.row && a.col + 1 === b.col) return "right"
  if (a.row === b.row && a.col - 1 === b.col) return "left"
  if (a.col === b.col && a.row + 1 === b.row) return "bottom"
  if (a.col === b.col && a.row - 1 === b.row) return "top"
  return null
}

export function expectedRelativeDelta(a: PuzzlePiece, b: PuzzlePiece): RelativeDelta {
  return {
    dx: b.solvedLeft - a.solvedLeft,
    dy: b.solvedTop - a.solvedTop,
  }
}

export function currentRelativeDelta(a: PuzzlePiece, b: PuzzlePiece): RelativeDelta {
  return {
    dx: b.left - a.left,
    dy: b.top - a.top,
  }
}

export function isDeltaWithinThreshold(
  current: RelativeDelta,
  expected: RelativeDelta,
  threshold: number
): boolean {
  const dx = current.dx - expected.dx
  const dy = current.dy - expected.dy
  return Math.hypot(dx, dy) <= Math.max(0, threshold)
}

export function arePiecesMatching(a: PuzzlePiece, b: PuzzlePiece, threshold: number): boolean {
  const direction = getPieceNeighborDirection(a, b)
  if (!direction) return false
  const expected = expectedRelativeDelta(a, b)
  const current = currentRelativeDelta(a, b)
  return isDeltaWithinThreshold(current, expected, threshold)
}

export function listAdjacentPairs(pieces: Array<PuzzlePiece>): Array<AdjacentPair> {
  const byCell = new Map<string, PuzzlePiece>()
  for (const piece of pieces) {
    byCell.set(`${piece.row}:${piece.col}`, piece)
  }

  const pairs: Array<AdjacentPair> = []
  for (const piece of pieces) {
    const right = byCell.get(`${piece.row}:${piece.col + 1}`)
    if (right) {
      pairs.push({ fromId: piece.id, toId: right.id, direction: "right" })
    }
    const bottom = byCell.get(`${piece.row + 1}:${piece.col}`)
    if (bottom) {
      pairs.push({ fromId: piece.id, toId: bottom.id, direction: "bottom" })
    }
  }
  return pairs
}

export function isPuzzleSolved(pieces: Array<PuzzlePiece>, threshold: number): boolean {
  if (pieces.length === 0) return false
  const pairs = listAdjacentPairs(pieces)
  const byId = new Map(pieces.map((piece) => [piece.id, piece]))
  for (const pair of pairs) {
    const from = byId.get(pair.fromId)
    const to = byId.get(pair.toId)
    if (!from || !to) return false
    if (!arePiecesMatching(from, to, threshold)) return false
  }
  return true
}

// --- Group merge helpers ---

/** Returns the world position of a piece given its group and member offset. */
export function getPieceWorldPosition(
  group: PieceGroup,
  member: GroupMember
): { left: number; top: number } {
  return {
    left: group.left + member.offsetLeft,
    top: group.top + member.offsetTop,
  }
}

/** Syncs each piece's left/top from its group's position plus its member offset. */
export function syncPiecePositionsFromGroups(
  pieces: Array<PuzzlePiece>,
  groups: Array<PieceGroup>
): Array<PuzzlePiece> {
  const piecePositionById = new Map<string, { left: number; top: number }>()

  for (const group of groups) {
    for (const member of group.members) {
      piecePositionById.set(member.pieceId, {
        left: group.left + member.offsetLeft,
        top: group.top + member.offsetTop,
      })
    }
  }

  return pieces.map((piece) => {
    const position = piecePositionById.get(piece.id)
    if (!position) return piece
    const { left, top } = position
    return { ...piece, left, top }
  })
}

export type MergeCandidate = {
  targetGroupId: string
  snapLeft: number
  snapTop: number
}

/**
 * Finds a valid merge candidate: a piece pair across the dragged group and another
 * group that are grid neighbors (horizontal/vertical only, no diagonal) and within
 * the matching threshold. Returns the snap position for the dragged group, or null
 * if no valid match. When multiple matches exist, returns only if they imply the
 * same snapped translation.
 */
export function findMergeCandidate(
  draggedGroupId: string,
  draggedGroupLeft: number,
  draggedGroupTop: number,
  groups: Array<PieceGroup>,
  pieces: Array<PuzzlePiece>,
  threshold: number
): MergeCandidate | null {
  const pieceMap = pieceByIdMap(pieces)
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const memberByPieceId = new Map<string, GroupMember>()
  for (const group of groups) {
    for (const member of group.members) {
      memberByPieceId.set(member.pieceId, member)
    }
  }

  const byCell = new Map<string, PuzzlePiece>()
  for (const piece of pieces) {
    byCell.set(`${piece.row}:${piece.col}`, piece)
  }

  const draggedGroup = groupById.get(draggedGroupId)
  if (!draggedGroup) return null

  const draggedPieceIds = new Set(draggedGroup.members.map((m) => m.pieceId))
  const candidates: Array<MergeCandidate> = []

  for (const memberA of draggedGroup.members) {
    const pieceA = pieceMap.get(memberA.pieceId)
    if (!pieceA) continue

    const aLeft = draggedGroupLeft + memberA.offsetLeft
    const aTop = draggedGroupTop + memberA.offsetTop

    const neighborPieces: Array<PuzzlePiece> = []
    const leftNeighbor = byCell.get(`${pieceA.row}:${pieceA.col - 1}`)
    if (leftNeighbor) neighborPieces.push(leftNeighbor)
    const rightNeighbor = byCell.get(`${pieceA.row}:${pieceA.col + 1}`)
    if (rightNeighbor) neighborPieces.push(rightNeighbor)
    const topNeighbor = byCell.get(`${pieceA.row - 1}:${pieceA.col}`)
    if (topNeighbor) neighborPieces.push(topNeighbor)
    const bottomNeighbor = byCell.get(`${pieceA.row + 1}:${pieceA.col}`)
    if (bottomNeighbor) neighborPieces.push(bottomNeighbor)

    for (const pieceB of neighborPieces) {
      if (draggedPieceIds.has(pieceB.id)) continue
      const targetGroup = groupById.get(pieceB.groupId)
      if (!targetGroup || targetGroup.id === draggedGroupId) continue
      const memberB = memberByPieceId.get(pieceB.id)
      if (!memberB) continue

      const bLeft = targetGroup.left + memberB.offsetLeft
      const bTop = targetGroup.top + memberB.offsetTop
      const expected = expectedRelativeDelta(pieceA, pieceB)
      const current = {
        dx: bLeft - aLeft,
        dy: bTop - aTop,
      }
      if (!isDeltaWithinThreshold(current, expected, threshold)) continue

      const snapLeft = bLeft - expected.dx - memberA.offsetLeft
      const snapTop = bTop - expected.dy - memberA.offsetTop
      candidates.push({ targetGroupId: targetGroup.id, snapLeft, snapTop })
    }
  }

  if (candidates.length === 0) return null

  const tol = 0.5
  const first = candidates[0]
  const allSame = candidates.every(
    (c) =>
      c.targetGroupId === first.targetGroupId &&
      Math.abs(c.snapLeft - first.snapLeft) <= tol &&
      Math.abs(c.snapTop - first.snapTop) <= tol
  )
  return allSame ? first : null
}

/**
 * Merges the dragged group into the target group at the given snap position.
 * Returns new groups and pieces arrays. The merged group keeps the target's id
 * and anchor; dragged members get offsets relative to that anchor.
 */
export function mergeGroups(
  groups: Array<PieceGroup>,
  pieces: Array<PuzzlePiece>,
  draggedGroupId: string,
  targetGroupId: string,
  snapLeft: number,
  snapTop: number
): { groups: Array<PieceGroup>; pieces: Array<PuzzlePiece> } {
  const draggedGroup = groups.find((g) => g.id === draggedGroupId)
  const targetGroup = groups.find((g) => g.id === targetGroupId)
  if (!draggedGroup || !targetGroup) {
    return { groups: [...groups], pieces: [...pieces] }
  }

  const draggedMembers: Array<GroupMember> = draggedGroup.members.map(
    (m) => ({
      pieceId: m.pieceId,
      offsetLeft: snapLeft + m.offsetLeft - targetGroup.left,
      offsetTop: snapTop + m.offsetTop - targetGroup.top,
    })
  )

  const mergedGroup: PieceGroup = {
    id: targetGroupId,
    left: targetGroup.left,
    top: targetGroup.top,
    stackOrder: Math.max(targetGroup.stackOrder, draggedGroup.stackOrder),
    members: [...targetGroup.members, ...draggedMembers],
  }

  const nextGroups = groups.filter(
    (g) => g.id !== draggedGroupId && g.id !== targetGroupId
  )
  nextGroups.push(mergedGroup)

  const mergedPieceIds = new Set(
    mergedGroup.members.map((m) => m.pieceId)
  )
  const nextPieces = pieces.map((p) =>
    mergedPieceIds.has(p.id)
      ? { ...p, groupId: targetGroupId }
      : p
  )

  const synced = syncPiecePositionsFromGroups(nextPieces, nextGroups)
  return { groups: nextGroups, pieces: synced }
}

export function groupRenderBoundsAt(
  group: PieceGroup,
  piecesById: Map<string, PuzzlePiece>,
  left: number,
  top: number
): Rect {
  const membersWithPieces = group.members.flatMap((member) => {
    const piece = piecesById.get(member.pieceId)
    return piece ? [{ member, piece }] : []
  })
  return renderBoundsForMembersAt(membersWithPieces, left, top)
}

type GroupRenderMember = {
  member: GroupMember
  piece: PuzzlePiece
}

type OverflowDirection = "left" | "right" | "top" | "bottom"

function renderBoundsForMembersAt(
  members: Array<GroupRenderMember>,
  left: number,
  top: number
): Rect {
  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY

  for (const { member, piece } of members) {
    const pieceLeft = left + member.offsetLeft + piece.renderOffsetX
    const pieceTop = top + member.offsetTop + piece.renderOffsetY
    const pieceRight = pieceLeft + piece.renderWidth
    const pieceBottom = pieceTop + piece.renderHeight
    minLeft = Math.min(minLeft, pieceLeft)
    minTop = Math.min(minTop, pieceTop)
    maxRight = Math.max(maxRight, pieceRight)
    maxBottom = Math.max(maxBottom, pieceBottom)
  }

  if (!Number.isFinite(minLeft) || !Number.isFinite(minTop)) {
    return {
      left,
      top,
      width: 0,
      height: 0,
    }
  }

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  }
}

function oppositeEdgeRenderBoundsAt(
  group: PieceGroup,
  piecesById: Map<string, PuzzlePiece>,
  left: number,
  top: number,
  overflowDirection: OverflowDirection
): Rect | null {
  const membersWithPieces = group.members.flatMap((member) => {
    const piece = piecesById.get(member.pieceId)
    return piece ? [{ member, piece }] : []
  })
  if (membersWithPieces.length === 0) return null

  let edgeValue: number
  let isOnOppositeEdge: (piece: PuzzlePiece) => boolean

  if (overflowDirection === "left") {
    edgeValue = membersWithPieces.reduce(
      (max, entry) => Math.max(max, entry.piece.col),
      Number.NEGATIVE_INFINITY
    )
    isOnOppositeEdge = (piece) => piece.col === edgeValue
  } else if (overflowDirection === "right") {
    edgeValue = membersWithPieces.reduce(
      (min, entry) => Math.min(min, entry.piece.col),
      Number.POSITIVE_INFINITY
    )
    isOnOppositeEdge = (piece) => piece.col === edgeValue
  } else if (overflowDirection === "top") {
    edgeValue = membersWithPieces.reduce(
      (max, entry) => Math.max(max, entry.piece.row),
      Number.NEGATIVE_INFINITY
    )
    isOnOppositeEdge = (piece) => piece.row === edgeValue
  } else {
    edgeValue = membersWithPieces.reduce(
      (min, entry) => Math.min(min, entry.piece.row),
      Number.POSITIVE_INFINITY
    )
    isOnOppositeEdge = (piece) => piece.row === edgeValue
  }

  const edgeMembers = membersWithPieces.filter(({ piece }) =>
    isOnOppositeEdge(piece)
  )
  if (edgeMembers.length === 0) return null
  return renderBoundsForMembersAt(edgeMembers, left, top)
}

export function clampGroupPositionWithinPlayground(
  group: PieceGroup,
  piecesById: Map<string, PuzzlePiece>,
  left: number,
  top: number,
  playgroundRect: Rect
): { left: number; top: number } {
  const bounds = groupRenderBoundsAt(group, piecesById, left, top)
  const boundsRight = bounds.left + bounds.width
  const boundsBottom = bounds.top + bounds.height
  const playgroundRight = playgroundRect.left + playgroundRect.width
  const playgroundBottom = playgroundRect.top + playgroundRect.height

  let nextLeft = left
  let nextTop = top

  if (bounds.left < playgroundRect.left || boundsRight > playgroundRight) {
    const leftEdgeBounds =
      bounds.left < playgroundRect.left
        ? oppositeEdgeRenderBoundsAt(group, piecesById, left, top, "left")
        : null
    const rightEdgeBounds =
      boundsRight > playgroundRight
        ? oppositeEdgeRenderBoundsAt(group, piecesById, left, top, "right")
        : null

    const leftThresholdPassed =
      leftEdgeBounds !== null &&
      leftEdgeBounds.left + leftEdgeBounds.width / 2 <= playgroundRect.left
    const rightThresholdPassed =
      rightEdgeBounds !== null &&
      rightEdgeBounds.left + rightEdgeBounds.width / 2 >= playgroundRight

    if (leftThresholdPassed && rightThresholdPassed) {
      const leftPastDistance =
        playgroundRect.left - (leftEdgeBounds.left + leftEdgeBounds.width / 2)
      const rightPastDistance =
        rightEdgeBounds.left + rightEdgeBounds.width / 2 - playgroundRight
      nextLeft +=
        leftPastDistance >= rightPastDistance
          ? playgroundRect.left - leftEdgeBounds.left
          : playgroundRight - (rightEdgeBounds.left + rightEdgeBounds.width)
    } else if (leftThresholdPassed) {
      nextLeft += playgroundRect.left - leftEdgeBounds.left
    } else if (rightThresholdPassed) {
      nextLeft += playgroundRight - (rightEdgeBounds.left + rightEdgeBounds.width)
    }
  }

  if (bounds.top < playgroundRect.top || boundsBottom > playgroundBottom) {
    const topEdgeBounds =
      bounds.top < playgroundRect.top
        ? oppositeEdgeRenderBoundsAt(group, piecesById, left, top, "top")
        : null
    const bottomEdgeBounds =
      boundsBottom > playgroundBottom
        ? oppositeEdgeRenderBoundsAt(group, piecesById, left, top, "bottom")
        : null

    const topThresholdPassed =
      topEdgeBounds !== null &&
      topEdgeBounds.top + topEdgeBounds.height / 2 <= playgroundRect.top
    const bottomThresholdPassed =
      bottomEdgeBounds !== null &&
      bottomEdgeBounds.top + bottomEdgeBounds.height / 2 >= playgroundBottom

    if (topThresholdPassed && bottomThresholdPassed) {
      const topPastDistance =
        playgroundRect.top - (topEdgeBounds.top + topEdgeBounds.height / 2)
      const bottomPastDistance =
        bottomEdgeBounds.top + bottomEdgeBounds.height / 2 - playgroundBottom
      nextTop +=
        topPastDistance >= bottomPastDistance
          ? playgroundRect.top - topEdgeBounds.top
          : playgroundBottom - (bottomEdgeBounds.top + bottomEdgeBounds.height)
    } else if (topThresholdPassed) {
      nextTop += playgroundRect.top - topEdgeBounds.top
    } else if (bottomThresholdPassed) {
      nextTop += playgroundBottom - (bottomEdgeBounds.top + bottomEdgeBounds.height)
    }
  }

  return {
    left: nextLeft,
    top: nextTop,
  }
}
