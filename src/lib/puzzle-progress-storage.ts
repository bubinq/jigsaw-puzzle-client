import type { PieceGroup } from "@/lib/puzzle-game"

export type PuzzleProgressGeometry = {
  boardWidth: number
  boardHeight: number
  playgroundWidth: number
  playgroundHeight: number
}

export type PuzzleProgressSnapshot = {
  solved: boolean
  geometry: PuzzleProgressGeometry
  groups: Array<PieceGroup>
}

type EncodedMember = [string, number, number]
type EncodedGroup = [string, number, number, number, Array<EncodedMember>]
type EncodedGeometry = [number, number, number, number]

type EncodedPuzzleProgress = {
  v: 1
  s: 0 | 1
  d: EncodedGeometry
  g: Array<EncodedGroup>
}

const STORAGE_SCHEMA_VERSION = 1
const STORAGE_KEY_PREFIX = "puzzle-progress:"

function round(value: number): number {
  return Math.round(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function parseEncodedPuzzleProgress(raw: string): EncodedPuzzleProgress | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isObject(parsed)) return null
    if (parsed.v !== STORAGE_SCHEMA_VERSION) return null
    if (parsed.s !== 0 && parsed.s !== 1) return null
    if (!Array.isArray(parsed.d) || parsed.d.length !== 4) return null
    if (!parsed.d.every((value) => isFiniteNumber(value))) return null
    if (!Array.isArray(parsed.g)) return null

    for (const group of parsed.g) {
      if (!Array.isArray(group) || group.length !== 5) return null
      if (typeof group[0] !== "string") return null
      if (!isFiniteNumber(group[1]) || !isFiniteNumber(group[2]) || !isFiniteNumber(group[3])) {
        return null
      }
      const members = group[4]
      if (!Array.isArray(members)) return null
      for (const member of members) {
        if (!Array.isArray(member) || member.length !== 3) return null
        if (typeof member[0] !== "string") return null
        if (!isFiniteNumber(member[1]) || !isFiniteNumber(member[2])) return null
      }
    }

    return parsed as EncodedPuzzleProgress
  } catch {
    return null
  }
}

function encodeGroups(groups: Array<PieceGroup>): Array<EncodedGroup> {
  return groups.map((group) => [
    group.id,
    group.left,
    group.top,
    round(group.stackOrder),
    group.members.map((member) => [member.pieceId, member.offsetLeft, member.offsetTop]),
  ])
}

function decodeGroups(encodedGroups: Array<EncodedGroup>): Array<PieceGroup> {
  return encodedGroups.map((group) => ({
    id: group[0],
    left: group[1],
    top: group[2],
    stackOrder: round(group[3]),
    members: group[4].map((member) => ({
      pieceId: member[0],
      offsetLeft: member[1],
      offsetTop: member[2],
    })),
  }))
}

function encodeGeometry(geometry: PuzzleProgressGeometry): EncodedGeometry {
  return [
    round(geometry.boardWidth),
    round(geometry.boardHeight),
    round(geometry.playgroundWidth),
    round(geometry.playgroundHeight),
  ]
}

function decodeGeometry(encoded: EncodedGeometry): PuzzleProgressGeometry {
  return {
    boardWidth: round(encoded[0]),
    boardHeight: round(encoded[1]),
    playgroundWidth: round(encoded[2]),
    playgroundHeight: round(encoded[3]),
  }
}

function resolveStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & {
      localStorage?: Storage
    }
    return globalWithStorage.localStorage ?? null
  } catch {
    return null
  }
}

export function buildPuzzleProgressStorageKey(puzzleId: string): string {
  return `${STORAGE_KEY_PREFIX}${puzzleId}`
}

export function encodePuzzleProgress(snapshot: PuzzleProgressSnapshot): string {
  const payload: EncodedPuzzleProgress = {
    v: STORAGE_SCHEMA_VERSION,
    s: snapshot.solved ? 1 : 0,
    d: encodeGeometry(snapshot.geometry),
    g: encodeGroups(snapshot.groups),
  }
  return JSON.stringify(payload)
}

export function decodePuzzleProgress(raw: string): PuzzleProgressSnapshot | null {
  const parsed = parseEncodedPuzzleProgress(raw)
  if (!parsed) return null
  return {
    solved: parsed.s === 1,
    geometry: decodeGeometry(parsed.d),
    groups: decodeGroups(parsed.g),
  }
}

export function readPuzzleProgress(puzzleId: string): PuzzleProgressSnapshot | null {
  const storage = resolveStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(buildPuzzleProgressStorageKey(puzzleId))
    if (!raw) return null
    return decodePuzzleProgress(raw)
  } catch {
    return null
  }
}

export function writePuzzleProgress(puzzleId: string, snapshot: PuzzleProgressSnapshot): void {
  const storage = resolveStorage()
  if (!storage) return
  try {
    storage.setItem(buildPuzzleProgressStorageKey(puzzleId), encodePuzzleProgress(snapshot))
  } catch {
    // Ignore quota/unavailable errors to avoid interrupting gameplay.
  }
}

export function clearPuzzleProgress(puzzleId: string): void {
  const storage = resolveStorage()
  if (!storage) return
  try {
    storage.removeItem(buildPuzzleProgressStorageKey(puzzleId))
  } catch {
    // Ignore storage errors.
  }
}

export function isPuzzleProgressCompatible(
  snapshot: PuzzleProgressSnapshot,
  geometry: PuzzleProgressGeometry
): boolean {
  return (
    round(snapshot.geometry.boardWidth) === round(geometry.boardWidth) &&
    round(snapshot.geometry.boardHeight) === round(geometry.boardHeight) &&
    round(snapshot.geometry.playgroundWidth) === round(geometry.playgroundWidth) &&
    round(snapshot.geometry.playgroundHeight) === round(geometry.playgroundHeight)
  )
}

function safeScale(from: number, to: number): number {
  const safeFrom = Math.max(1, from)
  return to / safeFrom
}

export function scalePuzzleProgressGroups(
  groups: Array<PieceGroup>,
  fromGeometry: PuzzleProgressGeometry,
  toGeometry: PuzzleProgressGeometry
): Array<PieceGroup> {
  const positionScaleX = safeScale(fromGeometry.playgroundWidth, toGeometry.playgroundWidth)
  const positionScaleY = safeScale(fromGeometry.playgroundHeight, toGeometry.playgroundHeight)
  const offsetScaleX = safeScale(fromGeometry.boardWidth, toGeometry.boardWidth)
  const offsetScaleY = safeScale(fromGeometry.boardHeight, toGeometry.boardHeight)

  return groups.map((group) => ({
    ...group,
    left: group.left * positionScaleX,
    top: group.top * positionScaleY,
    members: group.members.map((member) => ({
      ...member,
      offsetLeft: member.offsetLeft * offsetScaleX,
      offsetTop: member.offsetTop * offsetScaleY,
    })),
  }))
}
