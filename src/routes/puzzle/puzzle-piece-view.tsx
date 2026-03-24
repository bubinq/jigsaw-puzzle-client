import * as React from "react"
import type { PuzzlePiece } from "@/lib/puzzle-game"

export type PuzzlePieceViewProps = {
  piece: PuzzlePiece
  pieceImageSrc: string
  memberOffsetLeft: number
  memberOffsetTop: number
}

export const PuzzlePieceView = React.memo(function ({
  piece,
  pieceImageSrc,
  memberOffsetLeft,
  memberOffsetTop,
}: PuzzlePieceViewProps) {
  return (
    <div
      className="absolute"
      style={{
        left: memberOffsetLeft + piece.renderOffsetX,
        top: memberOffsetTop + piece.renderOffsetY,
        width: piece.renderWidth,
        height: piece.renderHeight,
        filter:
          "drop-shadow(0 1px 1px rgb(0 0 0 / 0.35)) drop-shadow(0 0 1px rgb(255 255 255 / 0.35))",
      }}
    >
      <img
        src={pieceImageSrc}
        alt="Puzzle piece"
        className="absolute max-w-none select-none"
        draggable={false}
        style={{
          left: 0,
          top: 0,
          width: piece.renderWidth,
          height: piece.renderHeight,
          pointerEvents: "none",
        }}
      />
    </div>
  )
})
