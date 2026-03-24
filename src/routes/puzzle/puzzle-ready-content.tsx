import * as React from "react"
import { PuzzlePlayground } from "./puzzle-playground"
import type { CreatePuzzleResponse } from "@/lib/api/types"
import type { PieceGroup, PuzzleGameImage, PuzzlePiece, Rect } from "@/lib/puzzle-game"
import { Card, CardContent } from "@/components/ui/card"

type PuzzleResponse = CreatePuzzleResponse

export type PuzzleReadyContentProps = {
  puzzle: PuzzleResponse["puzzle"]
  image: PuzzleGameImage
  boardRect: Rect
  pieces: Array<PuzzlePiece>
  groups: Array<PieceGroup>
  setGroups: React.Dispatch<React.SetStateAction<Array<PieceGroup>>>
  setPieces: React.Dispatch<React.SetStateAction<Array<PuzzlePiece>>>
  pieceImageSrcById: Map<string, string>
  playgroundRect: Rect
  solved: boolean
  onSolved: () => void
}

export function PuzzleReadyContent({
  puzzle,
  image,
  boardRect,
  pieces,
  groups,
  setGroups,
  setPieces,
  pieceImageSrcById,
  playgroundRect,
  solved,
  onSolved,
}: PuzzleReadyContentProps) {
  return (
    <Card className="w-full overflow-hidden rounded-none border-x-0">
      <CardContent className="flex flex-col gap-0 p-0">
        <div className="px-4 pb-3 pt-4 text-sm text-muted-foreground">
          {puzzle.name} - {puzzle.pieceCount} pieces
        </div>
        <PuzzlePlayground
          pieces={pieces}
          groups={groups}
          setGroups={setGroups}
          setPieces={setPieces}
          pieceImageSrcById={pieceImageSrcById}
          boardRect={boardRect}
          playgroundRect={playgroundRect}
          image={image}
          solved={solved}
          onSolved={onSolved}
        />
      </CardContent>
    </Card>
  )
}
