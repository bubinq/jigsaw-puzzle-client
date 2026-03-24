export type ImageMeta = {
  width: number
  height: number
}

export type GridOption = {
  rows: number
  cols: number
  pieceCount: number
}

export type OverlayData = {
  width: number
  height: number
  pathData: string
}

export type Connector = {
  direction: 1 | -1
  // variantIndex: number
}

export type ConnectorMaps = {
  horizontal: Array<Array<Connector>>
  vertical: Array<Array<Connector>>
}

export type EdgeDirection = -1 | 0 | 1

export type PieceEdges = {
  top: EdgeDirection
  right: EdgeDirection
  bottom: EdgeDirection
  left: EdgeDirection
}

const MIN_PIECES = 4
const MAX_PIECES = 3000
const MIN_SIDE = 2
const MAX_SIDE = 120
const CONNECTOR_CACHE_MAX_ENTRIES = 64
const OVERLAY_CACHE_MAX_ENTRIES = 64

const connectorMapCache = new Map<string, ConnectorMaps>()
const overlayCache = new Map<string, OverlayData>()

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

function pushCacheValue<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  maxEntries: number
) {
  if (cache.size >= maxEntries && !cache.has(key)) {
    const firstKey = cache.keys().next().value
    if (typeof firstKey === "string") cache.delete(firstKey)
  }
  cache.set(key, value)
}

const f = (n: number) => n.toFixed(3)

function buildStraightHLine(y: number, cols: number, cellW: number): string {
  const parts = [`M0,${f(y)}`]
  for (let col = 0; col < cols; col++) {
    const x1 = col * cellW
    const x2 = (col + 1) * cellW
    parts.push(
      `C${f(x1 + cellW / 3)},${f(y)},${f(x1 + (2 * cellW) / 3)},${f(y)},${f(x2)},${f(y)}`
    )
  }
  return parts.join("")
}

function buildStraightVLine(x: number, rows: number, cellH: number): string {
  const parts = [`M${f(x)},0`]
  for (let row = 0; row < rows; row++) {
    const y1 = row * cellH
    const y2 = (row + 1) * cellH
    parts.push(
      `C${f(x)},${f(y1 + cellH / 3)},${f(x)},${f(y1 + (2 * cellH) / 3)},${f(x)},${f(y2)}`
    )
  }
  return parts.join("")
}

function buildWavyHLine(
  baseY: number,
  width: number,
  cols: number,
  cellW: number,
  connectors: Array<Connector>,
  rng: () => number
): string {
  const parts = [`M0,${f(baseY)}`]
  let cx = 0
  let cy = baseY

  for (let col = 0; col < cols; col++) {
    const isLast = col === cols - 1
    const dir = connectors[col].direction
    const cellX = col * cellW
    const amp = cellW * (0.35 + rng() * 0.05)

    const neckFrac = 0.35 + rng() * 0.02
    const exitFrac = 0.65 + rng() * 0.02

    const nx1 = cellX + cellW * neckFrac
    const nx2 = cellX + cellW * exitFrac

    const endX = isLast ? width : cellX + cellW
    const endY = isLast ? baseY : baseY + dir * amp * (rng() * 0.05) // Wobble effect

    // --- Curve 1: The Neck Entrance ---
    const c1cp1x = cx + (nx1 - cx) * 0.5
    const c1cp1y = cy
    const c1cp2x = nx1 - cellW * 0.05
    const c1cp2y = baseY
    const c1ex = nx1
    const c1ey = baseY + dir * amp * 0.1

    // --- Curve 2: The Bulbous Head (The "Omega" shape) ---
    const c2cp1x = nx1 - cellW * 0.18
    const c2cp1y = baseY + dir * amp * 0.9
    const c2cp2x = nx2 + cellW * 0.18
    const c2cp2y = baseY + dir * amp * 0.9
    const c2ex = nx2
    const c2ey = baseY + dir * amp * 0.1

    // --- Curve 3: The Exit ---
    const c3cp1x = nx2 + cellW * 0.05
    const c3cp1y = baseY
    const c3cp2x = nx2 + (endX - nx2) * 0.5
    const c3cp2y = endY

    parts.push(
      `C${f(c1cp1x)},${f(c1cp1y)},${f(c1cp2x)},${f(c1cp2y)},${f(c1ex)},${f(c1ey)}`,
      `C${f(c2cp1x)},${f(c2cp1y)},${f(c2cp2x)},${f(c2cp2y)},${f(c2ex)},${f(c2ey)}`,
      `C${f(c3cp1x)},${f(c3cp1y)},${f(c3cp2x)},${f(c3cp2y)},${f(endX)},${f(endY)}`
    )

    cx = endX
    cy = endY
  }

  return parts.join("")
}

function buildWavyVLine(
  baseX: number,
  height: number,
  rows: number,
  cellH: number,
  connectors: Array<Connector>,
  rng: () => number
): string {
  const parts = [`M${f(baseX)},0`]
  let cy = 0

  for (let row = 0; row < rows; row++) {
    const isLast = row === rows - 1
    const dir = connectors[row].direction
    const cellY = row * cellH
    
    const amp = cellH * (0.36 + rng() * 0.04) 
    const neckFrac = 0.36 + rng() * 0.02
    const exitFrac = 0.64 + rng() * 0.02

    const ny1 = cellY + cellH * neckFrac
    const ny2 = cellY + cellH * exitFrac

    // Stabilize the end point so the vertical line doesn't "drift"
    const endY = isLast ? height : cellY + cellH
    const endX = isLast ? baseX : baseX + (rng() - 0.5) * (cellH * 0.02)

    // --- Curve 1: The shoulder (Straight line transitioning into the neck) ---
    const c1cp1y = cy + (ny1 - cy) * 0.5
    const c1cp1x = baseX
    const c1cp2y = ny1 - cellH * 0.05
    const c1cp2x = baseX
    const c1ey = ny1
    const c1ex = baseX + dir * amp * 0.1

    // --- Curve 2: The Bulbous Head (The "Omega" shape) ---
    const c2cp1y = ny1 - cellH * 0.18
    const c2cp1x = baseX + dir * amp * 0.95
    const c2cp2y = ny2 + cellH * 0.18   
    const c2cp2x = baseX + dir * amp * 0.95
    const c2ey = ny2
    const c2ex = baseX + dir * amp * 0.1

    // --- Curve 3: The Exit shoulder (Returning to the straight line) ---
    const c3cp1y = ny2 + cellH * 0.05
    const c3cp1x = baseX
    const c3cp2y = ny2 + (endY - ny2) * 0.5
    const c3cp2x = baseX
    
    parts.push(
      `C${f(c1cp1x)},${f(c1cp1y)},${f(c1cp2x)},${f(c1cp2y)},${f(c1ex)},${f(c1ey)}`,
      `C${f(c2cp1x)},${f(c2cp1y)},${f(c2cp2x)},${f(c2cp2y)},${f(c2ex)},${f(c2ey)}`,
      `C${f(c3cp1x)},${f(c3cp1y)},${f(c3cp2x)},${f(c3cp2y)},${f(endX)},${f(endY)}`
    )

    cy = endY
  }

  return parts.join("")
}

export function decodeImageMeta(file: File): Promise<ImageMeta> {
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      reject(new Error("invalid_image"))
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export function buildGridOptions(meta: ImageMeta): Array<GridOption> {
  if (meta.width <= 0 || meta.height <= 0) return []

  const aspect = meta.width / meta.height
  const byCount = new Map<number, GridOption & { score: number }>()
  const rowMax = Math.min(MAX_SIDE, Math.floor(Math.sqrt(MAX_PIECES)))
  const colMax = MAX_SIDE

  for (let rows = MIN_SIDE; rows <= rowMax; rows += 1) {
    for (let cols = MIN_SIDE; cols <= colMax; cols += 1) {
      const pieceCount = rows * cols
      if (pieceCount < MIN_PIECES || pieceCount > MAX_PIECES) continue

      const pieceWidth = meta.width / cols
      const pieceHeight = meta.height / rows
      if (pieceWidth < 24 || pieceHeight < 24) continue

      const gridAspect = cols / rows
      const logDiff = Math.abs(Math.log(gridAspect / aspect))
      if (logDiff > 0.35) continue

      const pieceRatio = pieceWidth / pieceHeight
      if (pieceRatio < 0.6 || pieceRatio > 1.7) continue

      const score = logDiff + Math.abs(pieceRatio - 1) * 0.25
      const prev = byCount.get(pieceCount)
      if (!prev || score < prev.score) {
        byCount.set(pieceCount, { rows, cols, pieceCount, score })
      }
    }
  }

  return Array.from(byCount.values())
    .sort((a, b) => a.pieceCount - b.pieceCount)
    .map(({ rows, cols, pieceCount }) => ({ rows, cols, pieceCount }))
}

export function buildOverlayData(
  width: number,
  height: number,
  rows: number,
  cols: number
): OverlayData {
  const safeRows = clamp(rows, MIN_SIDE, MAX_SIDE)
  const safeCols = clamp(cols, MIN_SIDE, MAX_SIDE)
  const cacheKey = `${width.toFixed(2)}:${height.toFixed(2)}:${safeRows}:${safeCols}`
  const cached = overlayCache.get(cacheKey)
  if (cached) return cached

  const cellW = width / safeCols
  const cellH = height / safeRows
  const connectors = buildConnectorMaps(safeRows, safeCols)

  const seed = safeRows * 48611 + safeCols * 97213
  const rng = mulberry32(seed)

  const paths: Array<string> = []

  paths.push(buildStraightHLine(0, safeCols, cellW))
  for (let row = 1; row < safeRows; row++) {
    const baseY = row * cellH
    paths.push(
      buildWavyHLine(
        baseY,
        width,
        safeCols,
        cellW,
        connectors.horizontal[row - 1],
        rng
      )
    )
  }
  paths.push(buildStraightHLine(height, safeCols, cellW))

  paths.push(buildStraightVLine(0, safeRows, cellH))
  for (let col = 1; col < safeCols; col++) {
    const baseX = col * cellW
    const colConnectors = connectors.vertical.map((r) => r[col - 1])
    paths.push(
      buildWavyVLine(baseX, height, safeRows, cellH, colConnectors, rng)
    )
  }
  paths.push(buildStraightVLine(width, safeRows, cellH))

  const overlay: OverlayData = {
    width,
    height,
    pathData: paths.join(" "),
  }
  pushCacheValue(overlayCache, cacheKey, overlay, OVERLAY_CACHE_MAX_ENTRIES)
  return overlay
}

export function buildConnectorMaps(rows: number, cols: number): ConnectorMaps {
  const safeRows = clamp(rows, MIN_SIDE, MAX_SIDE)
  const safeCols = clamp(cols, MIN_SIDE, MAX_SIDE)
  const cacheKey = `${safeRows}:${safeCols}`
  const cached = connectorMapCache.get(cacheKey)
  if (cached) return cached

  const seed = safeRows * 73856093 + safeCols * 19349663
  const random = mulberry32(seed)

  const horizontal: Array<Array<Connector>> = []
  for (let row = 0; row < safeRows - 1; row += 1) {
    const line: Array<Connector> = []
    for (let col = 0; col < safeCols; col += 1) {
      line.push({
        direction: random() > 0.5 ? 1 : -1,
        // variantIndex: Math.floor(random() * MAX_CONNECTORS),
      })
    }
    horizontal.push(line)
  }

  const vertical: Array<Array<Connector>> = []
  for (let row = 0; row < safeRows; row += 1) {
    const line: Array<Connector> = []
    for (let col = 0; col < safeCols - 1; col += 1) {
      line.push({
        direction: random() > 0.5 ? 1 : -1,
        // variantIndex: Math.floor(random() * MAX_CONNECTORS),
      })
    }
    vertical.push(line)
  }

  const maps = { horizontal, vertical }
  pushCacheValue(connectorMapCache, cacheKey, maps, CONNECTOR_CACHE_MAX_ENTRIES)
  return maps
}

export function pieceEdgesForCell(
  row: number,
  col: number,
  rows: number,
  cols: number,
  maps?: ConnectorMaps
): PieceEdges {
  const safeRows = clamp(rows, MIN_SIDE, MAX_SIDE)
  const safeCols = clamp(cols, MIN_SIDE, MAX_SIDE)
  const safeRow = clamp(row, 0, safeRows - 1)
  const safeCol = clamp(col, 0, safeCols - 1)
  const connectorMaps = maps ?? buildConnectorMaps(safeRows, safeCols)

  const top: EdgeDirection =
    safeRow === 0 ? 0 : (connectorMaps.horizontal[safeRow - 1][safeCol].direction as EdgeDirection)
  const bottom: EdgeDirection =
    safeRow === safeRows - 1 ? 0 : ((-connectorMaps.horizontal[safeRow][safeCol].direction) as EdgeDirection)
  const left: EdgeDirection =
    safeCol === 0 ? 0 : (connectorMaps.vertical[safeRow][safeCol - 1].direction as EdgeDirection)
  const right: EdgeDirection =
    safeCol === safeCols - 1 ? 0 : ((-connectorMaps.vertical[safeRow][safeCol].direction) as EdgeDirection)

  return { top, right, bottom, left }
}

export function countPieceCategories(
  rows: number,
  cols: number
): {
  corners: number
  edges: number
  interiors: number
} {
  if (rows < 2 || cols < 2) return { corners: 0, edges: 0, interiors: 0 }
  const corners = 4
  const edges = (rows - 2) * 2 + (cols - 2) * 2
  const interiors = (rows - 2) * (cols - 2)
  return { corners, edges, interiors }
}
