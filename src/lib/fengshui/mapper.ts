import type { Room, FlyingStarChart, FlyingStarPalace, FengshuiPoint } from '@/lib/types'

export interface RoomPalaceMapping {
  room: Room
  palace: FlyingStarPalace
  palacePosition: number
  centerX: number
  centerY: number
}

interface GridCell {
  col: number
  row: number
  x: number
  y: number
  width: number
  height: number
}

function getGridCells(imageWidth: number, imageHeight: number, rotation: number = 0): GridCell[] {
  const cellW = imageWidth / 3
  const cellH = imageHeight / 3
  const cells: GridCell[] = []

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push({
        col,
        row,
        x: col * cellW,
        y: row * cellH,
        width: cellW,
        height: cellH,
      })
    }
  }

  if (rotation === 0) return cells

  const cx = imageWidth / 2
  const cy = imageHeight / 2

  return cells.map(cell => {
    const corners = [
      rotatePoint(cell.x, cell.y, cx, cy, rotation),
      rotatePoint(cell.x + cell.width, cell.y, cx, cy, rotation),
      rotatePoint(cell.x + cell.width, cell.y + cell.height, cx, cy, rotation),
      rotatePoint(cell.x, cell.y + cell.height, cx, cy, rotation),
    ]

    const minX = Math.min(...corners.map(p => p.x))
    const maxX = Math.max(...corners.map(p => p.x))
    const minY = Math.min(...corners.map(p => p.y))
    const maxY = Math.max(...corners.map(p => p.y))

    return {
      col: cell.col,
      row: cell.row,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  })
}

function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

function overlapArea(
  room: { x: number; y: number; width: number; height: number },
  cell: GridCell
): number {
  const rx1 = room.x
  const ry1 = room.y
  const rx2 = room.x + room.width
  const ry2 = room.y + room.height

  const cx1 = cell.x
  const cy1 = cell.y
  const cx2 = cell.x + cell.width
  const cy2 = cell.y + cell.height

  const ox1 = Math.max(rx1, cx1)
  const oy1 = Math.max(ry1, cy1)
  const ox2 = Math.min(rx2, cx2)
  const oy2 = Math.min(ry2, cy2)

  if (ox1 >= ox2 || oy1 >= oy2) return 0
  return (ox2 - ox1) * (oy2 - oy1)
}

function findBestCell(roomBounds: { x: number; y: number; width: number; height: number }, cells: GridCell[]): GridCell | null {
  let best: GridCell | null = null
  let bestArea = -1

  for (const cell of cells) {
    const area = overlapArea(roomBounds, cell)
    if (area > bestArea) {
      bestArea = area
      best = cell
    }
  }

  return best
}

/** 洛书宫位编号 → Grid位置（行,列）的映射 */
const LUOSHU_CELL_MAP: Record<number, [number, number]> = {
  9: [0, 0], 2: [0, 2],
  3: [1, 0], 5: [1, 1], 7: [1, 2],
  8: [2, 0], 1: [2, 1], 4: [2, 2],
}

function cellToPalacePosition(col: number, row: number): number {
  for (const [pos, [r, c]] of Object.entries(LUOSHU_CELL_MAP)) {
    if (r === row && c === col) return parseInt(pos)
  }
  return 5
}

export function mapRoomsToPalaces(
  rooms: Room[],
  flyingStar: FlyingStarChart,
  imageWidth: number,
  imageHeight: number,
  rotation: number = 0
): RoomPalaceMapping[] {
  const cells = getGridCells(imageWidth, imageHeight, rotation)

  return rooms.map(room => {
    const bestCell = findBestCell(
      { x: room.bounds.x, y: room.bounds.y, width: room.bounds.width, height: room.bounds.height },
      cells
    )

    if (!bestCell) {
      return {
        room,
        palace: flyingStar.palaces.find(p => p.position === 5)!,
        palacePosition: 5,
        centerX: room.bounds.x + room.bounds.width / 2,
        centerY: room.bounds.y + room.bounds.height / 2,
      }
    }

    const pos = cellToPalacePosition(bestCell.col, bestCell.row)
    const palace = flyingStar.palaces.find(p => p.position === pos)!

    return {
      room,
      palace,
      palacePosition: pos,
      centerX: room.bounds.x + room.bounds.width / 2,
      centerY: room.bounds.y + room.bounds.height / 2,
    }
  })
}

function getCaiWeiOffset(palace: FlyingStarPalace): { dx: number; dy: number } {
  const star = palace.waterStar === 9 || palace.waterStar === 8 || palace.waterStar === 1
    ? palace.waterStar
    : palace.periodStar

  switch (star) {
    case 9: return { dx: 0.08, dy: -0.06 }
    case 8: return { dx: -0.06, dy: 0.08 }
    case 1: return { dx: 0.06, dy: 0.06 }
    case 2: return { dx: -0.08, dy: -0.08 }
    case 5: return { dx: 0, dy: 0 }
    default: return { dx: 0, dy: 0 }
  }
}

function getWenchangOffset(palace: FlyingStarPalace): { dx: number; dy: number } {
  if (palace.periodStar === 4 || palace.mountainStar === 4) return { dx: 0.1, dy: 0 }
  if (palace.periodStar === 1) return { dx: -0.1, dy: 0 }
  return { dx: 0, dy: -0.1 }
}

function getTaohuaOffset(palace: FlyingStarPalace): { dx: number; dy: number } {
  if (palace.waterStar === 4 || palace.periodStar === 4) return { dx: 0.08, dy: 0.08 }
  return { dx: -0.05, dy: 0.1 }
}

export function generatePointsFromMapping(
  mappings: RoomPalaceMapping[],
  flyingStar: FlyingStarChart
): FengshuiPoint[] {
  const points: FengshuiPoint[] = []
  let pointId = 1

  for (const mapping of mappings) {
    const { room, palace, centerX, centerY } = mapping
    const isGoodPalace = [9, 8, 1].includes(palace.periodStar)
    const isBadPalace = [2, 5].includes(palace.periodStar) || [2, 5].includes(palace.mountainStar)

    const severity = isBadPalace ? 'danger' : isGoodPalace ? 'good' : 'neutral'

    if (isGoodPalace) {
      const offset = getCaiWeiOffset(palace)
      points.push({
        id: `point_${String(pointId++).padStart(2, '0')}`,
        type: 'caifang',
        label: `财位·${palace.trigram}宫${palace.periodStar}运星`,
        x: centerX + offset.dx,
        y: centerY + offset.dy,
        room: room.name,
        analysis: `${palace.trigram}宫位，运星${palace.periodStar}，山星${palace.mountainStar}，向星${palace.waterStar}。${palace.interpretation}。此宫位为${room.name}，宜${palace.suggestion}`,
        suggestion: palace.suggestion,
        element: palace.wuxing,
        severity: 'good',
        layer: 'feixing',
      })
    }

    if (isBadPalace) {
      points.push({
        id: `point_${String(pointId++).padStart(2, '0')}`,
        type: 'xiongwei',
        label: `凶位·${palace.trigram}宫${palace.mountainStar}山星`,
        x: centerX,
        y: centerY,
        room: room.name,
        analysis: `${palace.trigram}宫位见${palace.mountainStar}山星，${palace.interpretation}。${room.name}需化解`,
        suggestion: `建议：${palace.suggestion}。可于该区域摆放对应五行物品化解`,
        element: palace.wuxing,
        severity: 'danger',
        layer: 'feixing',
      })
    }

    const wenOffset = getWenchangOffset(palace)
    points.push({
      id: `point_${String(pointId++).padStart(2, '0')}`,
      type: 'wenchang',
      label: `文昌位·${room.name}`,
      x: centerX + wenOffset.dx,
      y: centerY + wenOffset.dy,
      room: room.name,
      analysis: `${palace.trigram}宫文昌位，${palace.interpretation}`,
      suggestion: `文昌位宜保持明亮，可摆放文昌塔或四支毛笔催旺学业事业`,
      element: palace.wuxing,
      severity: palace.periodStar === 4 ? 'good' : 'neutral',
      layer: 'caifang',
    })

    const taoOffset = getTaohuaOffset(palace)
    points.push({
      id: `point_${String(pointId++).padStart(2, '0')}`,
      type: 'taohua',
      label: `桃花位·${room.name}`,
      x: centerX + taoOffset.dx,
      y: centerY + taoOffset.dy,
      room: room.name,
      analysis: `${palace.trigram}宫桃花位，${palace.periodStar === 4 ? '四绿文曲星临宫，利姻缘学业' : '需结合星组判断'}`,
      suggestion: `保持空间通透整洁，可摆放鲜花或绿色植物催旺桃花运`,
      element: palace.wuxing,
      severity: palace.periodStar === 4 ? 'good' : 'neutral',
      layer: 'caifang',
    })
  }

  return points
}

export function calculateGridRotation(facing: string): number {
  const rotations: Record<string, number> = {
    '子': 0,
    '癸': 0,
    '丑': 22.5,
    '艮': 45,
    '寅': 67.5,
    '甲': 90,
    '卯': 90,
    '乙': 90,
    '辰': 112.5,
    '巽': 135,
    '巳': 157.5,
    '丙': 180,
    '午': 180,
    '丁': 180,
    '未': 202.5,
    '坤': 225,
    '申': 247.5,
    '庚': 270,
    '酉': 270,
    '辛': 270,
    '戌': 292.5,
    '乾': 315,
    '亥': 337.5,
  }
  return rotations[facing] ?? 0
}
