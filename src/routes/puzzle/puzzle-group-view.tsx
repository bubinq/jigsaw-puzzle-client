import * as React from "react"
import { PuzzlePieceView } from "./puzzle-piece-view"
import type { PieceGroup, PuzzlePiece } from "@/lib/puzzle-game"

export type PuzzleGroupViewProps = {
  group: PieceGroup
  isActive: boolean
  isDragging: boolean
  hidden?: boolean
  interactive?: boolean
  left: number
  top: number
  stackOrder: number
  pieceMap: Map<string, PuzzlePiece>
  pieceImageSrcById: Map<string, string>
  onStartDrag: (
    event: React.PointerEvent<HTMLDivElement>,
    groupId: string,
    groupLeft: number,
    groupTop: number
  ) => void
  groupRef?: React.Ref<HTMLDivElement>
}

export const PuzzleGroupView = React.memo(function ({
  group,
  isActive,
  isDragging,
  hidden = false,
  interactive = true,
  left,
  top,
  stackOrder,
  pieceMap,
  pieceImageSrcById,
  onStartDrag,
  groupRef,
}: PuzzleGroupViewProps) {
  return (
    <div
      ref={groupRef}
      className="absolute touch-none"
      style={{
        left,
        top,
        zIndex: isActive ? stackOrder + 1 : stackOrder,
        willChange: isDragging ? "transform" : undefined,
        visibility: hidden ? "hidden" : "visible",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={(event) => {
        if (!interactive) return
        onStartDrag(event, group.id, left, top)
      }}
    >
      {group.members.map((member) => {
        const piece = pieceMap.get(member.pieceId)
        const pieceImageSrc = pieceImageSrcById.get(member.pieceId)
        if (!piece || !pieceImageSrc) return null
        return (
          <PuzzlePieceView
            key={member.pieceId}
            piece={piece}
            pieceImageSrc={pieceImageSrc}
            memberOffsetLeft={member.offsetLeft}
            memberOffsetTop={member.offsetTop}
          />
        )
      })}
    </div>
  )
})
