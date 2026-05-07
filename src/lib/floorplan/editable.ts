export interface Point {
  x: number
  y: number
}

export interface EditableRoom {
  id: string
  name: string
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony' | 'corridor' | 'study' | 'other'
  points: Point[]
  color: string
}

export interface FloorplanCanvas {
  width: number
  height: number
  rooms: EditableRoom[]
}

function rectToPolygon(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

function polygonBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function polygonArea(points: Point[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area / 2)
}

export function polygonCenter(points: Point[]): Point {
  let cx = 0, cy = 0
  for (const p of points) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / points.length, y: cy / points.length }
}

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

function pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): number {
  const dx = segEnd.x - segStart.x
  const dy = segEnd.y - segStart.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return distance(point, segStart)

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))

  const proj = { x: segStart.x + t * dx, y: segStart.y + t * dy }
  return distance(point, proj)
}

export function pointToPolygonDistance(point: Point, polygon: Point[]): number {
  let minDist = Infinity
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const d = pointToSegmentDistance(point, polygon[i], polygon[(i + 1) % n])
    if (d < minDist) minDist = d
  }
  return minDist
}

export function qwenRoomsToEditable(
  rooms: { name: string; type: string; bounds: { x: number; y: number; width: number; height: number } }[],
  targetWidth: number = 600,
  targetHeight: number = 500
): FloorplanCanvas {
  const typeColors: Record<string, string> = {
    living: '#f5e6d3',
    bedroom: '#e8f4ea',
    kitchen: '#fff3e0',
    bathroom: '#e3f2fd',
    balcony: '#f3e5f5',
    corridor: '#eceff1',
    study: '#e0f7fa',
    other: '#fafafa',
  }

  const scaleX = targetWidth
  const scaleY = targetHeight

  const editableRooms: EditableRoom[] = rooms.map((r, i) => ({
    id: `room_${i}`,
    name: r.name,
    type: (r.type as EditableRoom['type']) || 'other',
    points: rectToPolygon(
      r.bounds.x * scaleX,
      r.bounds.y * scaleY,
      r.bounds.width * scaleX,
      r.bounds.height * scaleY
    ),
    color: typeColors[r.type] || typeColors.other,
  }))

  const minX = Math.min(...editableRooms.flatMap(r => r.points.map(p => p.x)).concat([0]))
  const minY = Math.min(...editableRooms.flatMap(r => r.points.map(p => p.y)).concat([0]))
  const maxX = Math.max(...editableRooms.flatMap(r => r.points.map(p => p.x)).concat([targetWidth]))
  const maxY = Math.max(...editableRooms.flatMap(r => r.points.map(p => p.y)).concat([targetHeight]))
  const padding = 20

  const croppedWidth = Math.max(200, maxX - minX + padding * 2)
  const croppedHeight = Math.max(200, maxY - minY + padding * 2)
  const offsetX = minX - padding
  const offsetY = minY - padding

  const scaleRatio = Math.min(targetWidth / croppedWidth, targetHeight / croppedHeight)

  return {
    width: Math.round(croppedWidth * scaleRatio),
    height: Math.round(croppedHeight * scaleRatio),
    rooms: editableRooms.map(r => ({
      ...r,
      points: r.points.map(p => ({
        x: (p.x - offsetX) * scaleRatio,
        y: (p.y - offsetY) * scaleRatio,
      })),
    })),
  }
}

export function normalizeCanvas(canvas: FloorplanCanvas, padding: number = 20): FloorplanCanvas {
  if (canvas.rooms.length === 0) return canvas

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const room of canvas.rooms) {
    for (const p of room.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }

  const newWidth = maxX - minX + padding * 2
  const newHeight = maxY - minY + padding * 2
  const offsetX = minX - padding
  const offsetY = minY - padding

  return {
    width: Math.max(200, newWidth),
    height: Math.max(200, newHeight),
    rooms: canvas.rooms.map(r => ({
      ...r,
      points: r.points.map(p => ({ x: p.x - offsetX, y: p.y - offsetY })),
    })),
  }
}

export function canvasToPalaceMappings(
  canvas: FloorplanCanvas,
  flyingStar: { palaces: { position: number; direction: string; trigram: string; periodStar: number; mountainStar: number; waterStar: number; interpretation: string; suggestion: string }[] }
): {
  roomName: string
  roomType: string
  palacePosition: number
  palaceDirection: string
  palaceTrigram: string
  periodStar: number
  mountainStar: number
  waterStar: number
  interpretation: string
  centerX: number
  centerY: number
}[] {
  const cellW = canvas.width / 3
  const cellH = canvas.height / 3

  const LUOSHU_CELL_MAP: Record<number, [number, number]> = {
    9: [0, 0], 2: [0, 2],
    3: [1, 0], 5: [1, 1], 7: [1, 2],
    8: [2, 0], 1: [2, 1], 4: [2, 2],
  }

  return canvas.rooms.map(room => {
    const center = polygonCenter(room.points)

    let cellCol = Math.floor(center.x / cellW)
    let cellRow = Math.floor(center.y / cellH)
    cellCol = Math.max(0, Math.min(2, cellCol))
    cellRow = Math.max(0, Math.min(2, cellRow))

    let palacePos = 5
    for (const [pos, [r, c]] of Object.entries(LUOSHU_CELL_MAP)) {
      if (r === cellRow && c === cellCol) {
        palacePos = parseInt(pos)
        break
      }
    }

    const palace = flyingStar.palaces.find(p => p.position === palacePos)!

    return {
      roomName: room.name,
      roomType: room.type,
      palacePosition: palacePos,
      palaceDirection: palace.direction,
      palaceTrigram: palace.trigram,
      periodStar: palace.periodStar,
      mountainStar: palace.mountainStar,
      waterStar: palace.waterStar,
      interpretation: palace.interpretation,
      centerX: center.x / canvas.width,
      centerY: center.y / canvas.height,
    }
  })
}

export function addVertexToEdge(room: EditableRoom, edgeIndex: number, newPoint: Point): EditableRoom {
  const newPoints = [...room.points]
  newPoints.splice(edgeIndex + 1, 0, newPoint)
  return { ...room, points: newPoints }
}

export function removeVertex(room: EditableRoom, vertexIndex: number): EditableRoom {
  if (room.points.length <= 3) return room
  const newPoints = room.points.filter((_, i) => i !== vertexIndex)
  return { ...room, points: newPoints }
}

export function moveVertex(room: EditableRoom, vertexIndex: number, newPos: Point): EditableRoom {
  const newPoints = room.points.map((p, i) => i === vertexIndex ? newPos : p)
  return { ...room, points: newPoints }
}

export function moveRoom(room: EditableRoom, dx: number, dy: number): EditableRoom {
  return {
    ...room,
    points: room.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
  }
}
