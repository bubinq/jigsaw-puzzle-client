import * as React from "react"
import { PuzzleGroupView } from "./puzzle-group-view"
import type {
  PieceGroup,
  PuzzleGameImage,
  PuzzlePiece,
  Rect,
} from "@/lib/puzzle-game"
import {
  bringGroupToFront,
  clampGroupPositionWithinPlayground,
  findMergeCandidate,
  isPuzzleSolved,
  mergeGroups,
  moveGroup,
  pieceByIdMap,
  syncPiecePositionsFromGroups,
} from "@/lib/puzzle-game"
import { useSoundPreferences } from "@/hooks/use-sound-preferences"

export type PuzzlePlaygroundProps = {
  pieces: Array<PuzzlePiece>
  groups: Array<PieceGroup>
  setGroups: React.Dispatch<React.SetStateAction<Array<PieceGroup>>>
  setPieces: React.Dispatch<React.SetStateAction<Array<PuzzlePiece>>>
  pieceImageSrcById: Map<string, string>
  boardRect: Rect
  playgroundRect: Rect
  image: PuzzleGameImage
  solved: boolean
  onSolved: () => void
  onDrop: (nextGroups: Array<PieceGroup>, nextSolved: boolean) => void
}

type Point = {
  left: number
  top: number
}

type ActiveDrag = {
  groupId: string
  offsetX: number
  offsetY: number
}

export function PuzzlePlayground({
  pieces,
  groups,
  setGroups,
  setPieces,
  pieceImageSrcById,
  boardRect,
  playgroundRect,
  image,
  solved,
  onSolved,
  onDrop,
}: PuzzlePlaygroundProps) {
  const { pieceMatchSoundEnabled } = useSoundPreferences()
  const pieceMap = React.useMemo(() => pieceByIdMap(pieces), [pieces])
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = React.useState<Point | null>(null)
  const activeDragRef = React.useRef<ActiveDrag | null>(null)
  const pendingPositionRef = React.useRef<Point | null>(null)
  const dragRafRef = React.useRef<number | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const mergeAudioRef = React.useRef<HTMLAudioElement | null>(null)

  const MATCH_THRESHOLD = 6

  const applyOverlayPosition = React.useCallback((position: Point) => {
    const element = overlayRef.current
    if (!element) return
    element.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`
  }, [])

  const playMergeSound = React.useCallback(() => {
    if (!pieceMatchSoundEnabled || typeof window === "undefined") return
    const audio = mergeAudioRef.current ?? new Audio("/match.mp3")
    if (!mergeAudioRef.current) {
      audio.preload = "auto"
      mergeAudioRef.current = audio
    }
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }, [pieceMatchSoundEnabled])

  const endDrag = React.useCallback(() => {
    const activeDrag = activeDragRef.current
    const finalPosition = pendingPositionRef.current
    if (!activeDrag || !finalPosition) {
      activeDragRef.current = null
      pendingPositionRef.current = null
      setActiveGroupId(null)
      setDragStartPosition(null)
      return
    }

    const activeGroup = groups.find((group) => group.id === activeDrag.groupId)
    if (!activeGroup) {
      activeDragRef.current = null
      pendingPositionRef.current = null
      setActiveGroupId(null)
      setDragStartPosition(null)
      return
    }

    const clampedPosition = clampGroupPositionWithinPlayground(
      activeGroup,
      pieceMap,
      finalPosition.left,
      finalPosition.top,
      playgroundRect
    )

    const candidate = findMergeCandidate(
      activeDrag.groupId,
      clampedPosition.left,
      clampedPosition.top,
      groups,
      pieces,
      MATCH_THRESHOLD
    )

    let nextGroups: Array<PieceGroup>
    let nextPieces: Array<PuzzlePiece>
    if (candidate) {
      const result = mergeGroups(
        groups,
        pieces,
        activeDrag.groupId,
        candidate.targetGroupId,
        candidate.snapLeft,
        candidate.snapTop
      )
      nextGroups = result.groups
      nextPieces = result.pieces
      playMergeSound()
    } else {
      nextGroups = moveGroup(
        groups,
        activeDrag.groupId,
        clampedPosition.left,
        clampedPosition.top
      )
      nextPieces = syncPiecePositionsFromGroups(pieces, nextGroups)
    }

    setGroups(nextGroups)
    setPieces(nextPieces)
    onDrop(nextGroups, isPuzzleSolved(nextPieces, MATCH_THRESHOLD))

    activeDragRef.current = null
    pendingPositionRef.current = null
    setActiveGroupId(null)
    setDragStartPosition(null)
  }, [groups, onDrop, pieceMap, pieces, playMergeSound, playgroundRect, setGroups, setPieces])

  React.useEffect(() => {
    if (solved) return
    if (isPuzzleSolved(pieces, 6)) {
      onSolved()
    }
  }, [onSolved, pieces, solved])

  React.useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const activeDrag = activeDragRef.current
      if (!activeDrag) return
      const nextPosition = {
        left: event.clientX - activeDrag.offsetX,
        top: event.clientY - activeDrag.offsetY,
      }
      pendingPositionRef.current = nextPosition
      if (dragRafRef.current !== null) return
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pending = pendingPositionRef.current
        const dragState = activeDragRef.current
        if (!pending || !dragState) return
        applyOverlayPosition(pending)
      })
    }

    function onPointerUp() {
      endDrag()
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
    }
  }, [applyOverlayPosition, endDrag])

  const handleStartDrag = React.useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      groupId: string,
      groupLeft: number,
      groupTop: number
    ) => {
      if (solved) return
      event.preventDefault()
      activeDragRef.current = {
        groupId,
        offsetX: event.clientX - groupLeft,
        offsetY: event.clientY - groupTop,
      }
      const startPosition = { left: groupLeft, top: groupTop }
      pendingPositionRef.current = startPosition
      setDragStartPosition(startPosition)
      setGroups((currentGroups) => bringGroupToFront(currentGroups, groupId))
      setActiveGroupId(groupId)
    },
    [setGroups, solved]
  )

  React.useEffect(() => {
    if (!dragStartPosition) return
    applyOverlayPosition(dragStartPosition)
  }, [applyOverlayPosition, dragStartPosition])

  const overlayGroup = React.useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  )
  const topStackOrder = React.useMemo(
    () => groups.reduce((maxOrder, group) => Math.max(maxOrder, group.stackOrder), 0),
    [groups]
  )

  return (
    <div
      className="relative overflow-hidden rounded-md border border-zinc-400 bg-zinc-300"
      style={{
        width: `${playgroundRect.width}px`,
        height: `${playgroundRect.height}px`,
      }}
    >
      {!solved &&
        groups.map((group) => (
          <PuzzleGroupView
            key={group.id}
            group={group}
            isActive={activeGroupId === group.id}
            hidden={activeGroupId === group.id}
            left={group.left}
            top={group.top}
            stackOrder={group.stackOrder}
            pieceMap={pieceMap}
            pieceImageSrcById={pieceImageSrcById}
            onStartDrag={handleStartDrag}
            isDragging={false}
          />
        ))}
      {!solved && overlayGroup && dragStartPosition && (
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 32000,
            transform: `translate3d(${dragStartPosition.left}px, ${dragStartPosition.top}px, 0)`,
          }}
        >
          <PuzzleGroupView
            group={overlayGroup}
            isActive
            isDragging
            interactive={false}
            left={0}
            top={0}
            stackOrder={topStackOrder + 2}
            pieceMap={pieceMap}
            pieceImageSrcById={pieceImageSrcById}
            onStartDrag={handleStartDrag}
          />
        </div>
      )}

      {solved && (
        <div
          className="absolute"
          style={{
            left: `${boardRect.left}px`,
            top: `${boardRect.top}px`,
            width: `${boardRect.width}px`,
            height: `${boardRect.height}px`,
          }}
        >
          <img
            src={image.src}
            alt="Solved puzzle"
            className="h-full w-full rounded-sm object-cover shadow-lg"
            draggable={false}
          />
        </div>
      )}
    </div>
  )
}
