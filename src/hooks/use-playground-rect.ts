import * as React from "react"
import type { Rect } from "@/lib/puzzle-game"

function currentPlaygroundRect(): Rect {
  if (typeof window === "undefined") {
    return {
      left: 0,
      top: 0,
      width: 1060,
      height: 720,
    }
  }

  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: Math.max(100, Math.round(window.innerHeight * 0.6)),
  }
}

export function usePlaygroundRect(): Rect {
  const [playgroundRect, setPlaygroundRect] = React.useState<Rect>(() =>
    currentPlaygroundRect()
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const updatePlaygroundRect = () => {
      const nextRect = currentPlaygroundRect()

      setPlaygroundRect((currentRect) => {
        if (
          currentRect.left === nextRect.left &&
          currentRect.top === nextRect.top &&
          currentRect.width === nextRect.width &&
          currentRect.height === nextRect.height
        ) {
          return currentRect
        }

        return nextRect
      })
    }

    updatePlaygroundRect()
    window.addEventListener("resize", updatePlaygroundRect)
    return () => {
      window.removeEventListener("resize", updatePlaygroundRect)
    }
  }, [])

  return playgroundRect
}
