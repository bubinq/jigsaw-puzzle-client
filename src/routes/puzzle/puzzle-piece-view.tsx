import * as React from "react"
import type { PuzzlePiece } from "@/lib/puzzle-game"
import { PIECE_BITMAP_PAD } from "@/lib/puzzle-piece-raster"

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
  const pad = PIECE_BITMAP_PAD
  const paddedWidth = piece.renderWidth + pad * 2
  const paddedHeight = piece.renderHeight + pad * 2
  return (
    <div
      className="absolute"
      style={{
        left: memberOffsetLeft + piece.renderOffsetX - pad,
        top: memberOffsetTop + piece.renderOffsetY - pad,
        width: paddedWidth,
        height: paddedHeight,
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
          width: paddedWidth,
          height: paddedHeight,
          pointerEvents: "none",
        }}
      />
    </div>
  )
})
