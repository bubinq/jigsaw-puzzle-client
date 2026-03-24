import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { hashSeed } from "./hash-seed"
import { PuzzleReadyContent } from "./puzzle-ready-content"
import { PuzzleStatusCard } from "./puzzle-status-card"
import type { CreatePuzzleResponse } from "@/lib/api/types"
import type { PieceGroup, PuzzleGameImage, PuzzlePiece } from "@/lib/puzzle-game"
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
} from "@/lib/puzzle-game"
import { buildAllPieceBitmapDataUrls } from "@/lib/puzzle-piece-raster"

export const Route = createFileRoute("/puzzle/$puzzleId")({
  component: PuzzlePage,
})

type PuzzleResponse = CreatePuzzleResponse

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
  const playgroundRect = usePlaygroundRect()
  const boardRect = React.useMemo(
    () =>
      image
        ? buildPlaygroundSolvedBoardRect(playgroundRect, image.width, image.height)
        : playgroundRect,
    [image, playgroundRect]
  )

  React.useEffect(() => {
    const controller = new AbortController()
    const isAborted = () => controller.signal.aborted
    setLoading(true)
    setError(null)
    setSolved(false)

    void (async () => {
      try {
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
          playgroundRect,
          imageMeta.width,
          imageMeta.height
        )
        const solvedPieces = buildPuzzlePieces(grid.rows, grid.cols, nextBoardRect)
        const shuffledPieces = randomizePiecePositions(
          solvedPieces,
          playgroundRect,
          hashSeed(puzzleId)
        )
        const pieceBitmaps = await buildAllPieceBitmapDataUrls(
          solvedPieces,
          imageMeta.src,
          nextBoardRect
        )
        const initialGroups = createSinglePieceGroups(shuffledPieces)

        setPuzzle(res.puzzle)

        // TODO: Since image data is only needed when the puzzle is solved, it can be deffered maybe?
        setImage(imageMeta)
        setPieces(shuffledPieces)
        setGroups(initialGroups)
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
  }, [playgroundRect, puzzleId])

  return (
    <RequireAuth>
      <section className="relative left-1/2 w-screen max-w-none -translate-x-1/2">
        <div className="px-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Puzzle playground
          </h1>
        </div>

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
            />
          </div>
        )}
      </section>
    </RequireAuth>
  )
}
