import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { hashSeed } from "./hash-seed"
import { PuzzleReadyContent } from "./puzzle-ready-content"
import { PuzzleStatusCard } from "./puzzle-status-card"
import type { CreatePuzzleResponse } from "@/lib/api/types"
import type { PieceGroup, PuzzleGameImage, PuzzlePiece } from "@/lib/puzzle-game"
import type { PuzzleProgressGeometry } from "@/lib/puzzle-progress-storage"
import {
  clearPuzzleProgress,
  readPuzzleProgress,
  scalePuzzleProgressGroups,
  writePuzzleProgress,
} from "@/lib/puzzle-progress-storage"
import { RequireAuth } from "@/components/auth/require-auth"
import { usePlaygroundRect } from "@/hooks/use-playground-rect"
import { apiFetch, apiSameOriginUrl } from "@/lib/api/client"
import {
  buildPlaygroundSolvedBoardRect,
  buildPuzzlePieces,
  createSinglePieceGroups,
  decodeImageMetaFromUrl,
  deriveGridForPieceCount,
  randomizePiecePositions,
  syncPiecePositionsFromGroups,
} from "@/lib/puzzle-game"

import { buildAllPieceBitmapDataUrls } from "@/lib/puzzle-piece-raster"

export const Route = createFileRoute("/puzzle/$puzzleId")({
  component: PuzzlePage,
})

const RESIZE_REBUILD_DEBOUNCE_MS = 200

type PuzzleResponse = CreatePuzzleResponse

function buildGeometry(boardRect: { width: number; height: number }, playgroundRect: { width: number; height: number }) {
  return {
    boardWidth: Math.round(boardRect.width),
    boardHeight: Math.round(boardRect.height),
    playgroundWidth: Math.round(playgroundRect.width),
    playgroundHeight: Math.round(playgroundRect.height),
  } satisfies PuzzleProgressGeometry
}

function isSameGeometry(left: PuzzleProgressGeometry, right: PuzzleProgressGeometry): boolean {
  return (
    left.boardWidth === right.boardWidth &&
    left.boardHeight === right.boardHeight &&
    left.playgroundWidth === right.playgroundWidth &&
    left.playgroundHeight === right.playgroundHeight
  )
}

function buildRandomizedState(
  solvedPieces: Array<PuzzlePiece>,
  playgroundRect: { left: number; top: number; width: number; height: number },
  seed: number
): { pieces: Array<PuzzlePiece>; groups: Array<PieceGroup> } {
  const randomizedPieces = randomizePiecePositions(solvedPieces, playgroundRect, seed)
  const groups = createSinglePieceGroups(randomizedPieces)
  return { pieces: randomizedPieces, groups }
}

function restoreStateFromGroups(
  solvedPieces: Array<PuzzlePiece>,
  groups: Array<PieceGroup>
): { pieces: Array<PuzzlePiece>; groups: Array<PieceGroup> } | null {
  const pieceIds = new Set(solvedPieces.map((piece) => piece.id))
  const groupByPieceId = new Map<string, string>()
  for (const group of groups) {
    for (const member of group.members) {
      if (!pieceIds.has(member.pieceId)) return null
      if (groupByPieceId.has(member.pieceId)) return null
      groupByPieceId.set(member.pieceId, group.id)
    }
  }

  if (groupByPieceId.size !== solvedPieces.length) {
    return null
  }

  const groupedPieces = solvedPieces.map((piece) => {
    const groupId = groupByPieceId.get(piece.id)
    if (!groupId) return piece
    return { ...piece, groupId }
  })

  return {
    groups,
    pieces: syncPiecePositionsFromGroups(groupedPieces, groups),
  }
}

function PuzzlePage() {
  const { puzzleId } = Route.useParams()
  const [puzzle, setPuzzle] = React.useState<PuzzleResponse["puzzle"] | null>(
    null
  )
  const [image, setImage] = React.useState<PuzzleGameImage | null>(null)
  const [pieces, setPieces] = React.useState<Array<PuzzlePiece>>([])
  const [groups, setGroups] = React.useState<Array<PieceGroup>>([])
  const [pieceImageSrcById, setPieceImageSrcById] = React.useState<Map<string, string>>(new Map())
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [solved, setSolved] = React.useState(false)
  const solvedPiecesRef = React.useRef<Array<PuzzlePiece>>([])
  const playgroundRect = usePlaygroundRect()
  const boardRect = React.useMemo(
    () =>
      image
        ? buildPlaygroundSolvedBoardRect(playgroundRect, image.width, image.height)
        : playgroundRect,
    [image, playgroundRect]
  )
  const geometry = React.useMemo(
    () => buildGeometry(boardRect, playgroundRect),
    [boardRect, playgroundRect]
  )
  const latestPlaygroundRectRef = React.useRef(playgroundRect)
  const lastAppliedGeometryRef = React.useRef<PuzzleProgressGeometry | null>(null)
  const resizeApplyGenerationRef = React.useRef(0)

  React.useEffect(() => {
    latestPlaygroundRectRef.current = playgroundRect
  }, [playgroundRect])

  React.useEffect(() => {
    const controller = new AbortController()
    const isAborted = () => controller.signal.aborted
    lastAppliedGeometryRef.current = null
    setLoading(true)
    setError(null)
    setSolved(false)
    solvedPiecesRef.current = []

    void (async () => {
      try {
        const loadPlaygroundRect = latestPlaygroundRectRef.current
        const res = await apiFetch<PuzzleResponse>(`/puzzles/${puzzleId}`, {
          method: "GET",
          signal: controller.signal,
        })


        const nextImageUrl = apiSameOriginUrl(`/puzzles/${puzzleId}/image`)
        const imageMeta = await decodeImageMetaFromUrl(nextImageUrl)
        if (isAborted()) return

        const grid = deriveGridForPieceCount(
          res.puzzle.pieceCount,
          imageMeta.width,
          imageMeta.height
        )
        const nextBoardRect = buildPlaygroundSolvedBoardRect(
          loadPlaygroundRect,
          imageMeta.width,
          imageMeta.height
        )
        const solvedPieces = buildPuzzlePieces(grid.rows, grid.cols, nextBoardRect)
        solvedPiecesRef.current = solvedPieces
        const pieceBitmaps = await buildAllPieceBitmapDataUrls(
          solvedPieces,
          imageMeta.src,
          nextBoardRect
        )
        const fallbackState = buildRandomizedState(
          solvedPieces,
          loadPlaygroundRect,
          hashSeed(puzzleId)
        )
        const nextGeometry = buildGeometry(nextBoardRect, loadPlaygroundRect)
        const savedProgress = readPuzzleProgress(puzzleId)

        let nextPieces = fallbackState.pieces
        let nextGroups = fallbackState.groups
        let nextSolved = false

        if (savedProgress) {
          const scaledSavedGroups = scalePuzzleProgressGroups(
            savedProgress.groups,
            savedProgress.geometry,
            nextGeometry
          )
          const restoredState = restoreStateFromGroups(solvedPieces, scaledSavedGroups)
          if (restoredState) {
            nextPieces = restoredState.pieces
            nextGroups = restoredState.groups
            nextSolved = savedProgress.solved
          }
        }
        lastAppliedGeometryRef.current = nextGeometry

        setPuzzle(res.puzzle)

        // TODO: Since image data is only needed when the puzzle is solved, it can be deffered maybe?
        setImage(imageMeta)
        setPieces(nextPieces)
        setGroups(nextGroups)
        setSolved(nextSolved)
        setPieceImageSrcById(pieceBitmaps)
      } catch (err) {
        if (isAborted()) return
        setError(err instanceof Error ? err.message : "puzzle_load_failed")
      } finally {
        if (!isAborted()) {
          setLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [puzzleId])

  React.useEffect(() => {
    if (loading || error || !puzzle || !image || groups.length === 0) return
    const previousGeometry = lastAppliedGeometryRef.current
    if (!previousGeometry) {
      lastAppliedGeometryRef.current = geometry
      return
    }
    if (isSameGeometry(previousGeometry, geometry)) {
      return
    }

    const grid = deriveGridForPieceCount(
      puzzle.pieceCount,
      image.width,
      image.height
    )
    const nextBoardRect = buildPlaygroundSolvedBoardRect(
      playgroundRect,
      image.width,
      image.height
    )
    const nextSolvedPieces = buildPuzzlePieces(grid.rows, grid.cols, nextBoardRect)
    const scaledGroups = scalePuzzleProgressGroups(groups, previousGeometry, geometry)
    const restoredState = restoreStateFromGroups(nextSolvedPieces, scaledGroups)
    if (!restoredState) {
      return
    }

    const generation = resizeApplyGenerationRef.current + 1
    resizeApplyGenerationRef.current = generation
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const nextBitmaps = await buildAllPieceBitmapDataUrls(
          nextSolvedPieces,
          image.src,
          nextBoardRect
        )
        if (resizeApplyGenerationRef.current !== generation) return
        solvedPiecesRef.current = nextSolvedPieces
        lastAppliedGeometryRef.current = geometry
        setGroups(restoredState.groups)
        setPieces(restoredState.pieces)
        setPieceImageSrcById(nextBitmaps)
      })()
    }, RESIZE_REBUILD_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      if (resizeApplyGenerationRef.current === generation) {
        resizeApplyGenerationRef.current = generation + 1
      }
    }
  }, [error, geometry, groups, image, loading, playgroundRect, puzzle])

  const handleResetPuzzle = React.useCallback(() => {
    clearPuzzleProgress(puzzleId)
    setSolved(false)
    if (solvedPiecesRef.current.length === 0) return
    const resetState = buildRandomizedState(
      solvedPiecesRef.current,
      playgroundRect,
      hashSeed(puzzleId)
    )
    setPieces(resetState.pieces)
    setGroups(resetState.groups)
  }, [playgroundRect, puzzleId])

  const handleDropPersist = React.useCallback(
    (nextGroups: Array<PieceGroup>, nextSolved: boolean) => {
      if (loading || error || !puzzle || !image || nextGroups.length === 0) return
      writePuzzleProgress(puzzleId, {
        solved: nextSolved,
        groups: nextGroups,
        geometry,
      })
    },
    [error, geometry, image, loading, puzzle, puzzleId]
  )

  return (
    <RequireAuth>
      <section className="relative left-1/2 w-screen max-w-none -translate-x-1/2">
        {loading ? (
          <div className="px-4 pt-3">
            <PuzzleStatusCard message="Loading puzzle…" />
          </div>
        ) : error ? (
          <div className="px-4 pt-3">
            <PuzzleStatusCard message={error} destructive />
          </div>
        ) : !puzzle || !image ? (
          <div className="px-4 pt-3">
            <PuzzleStatusCard message="Puzzle unavailable." />
          </div>
        ) : (
          <div className="pt-3">
            <PuzzleReadyContent
              puzzle={puzzle}
              image={image}
              boardRect={boardRect}
              pieces={pieces}
              groups={groups}
              setGroups={setGroups}
              setPieces={setPieces}
              pieceImageSrcById={pieceImageSrcById}
              playgroundRect={playgroundRect}
              solved={solved}
              onSolved={() => setSolved(true)}
              onReset={handleResetPuzzle}
              onDrop={handleDropPersist}
            />
          </div>
        )}
      </section>
    </RequireAuth>
  )
}
