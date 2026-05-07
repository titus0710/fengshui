'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { FengshuiPoint, FlyingStarChart, LayerType, LayerInfo, FloorplanResult } from '@/lib/types'
import { PointMarkers, PointLegend } from './PointDetail'
import type { Point } from '@/lib/floorplan/editable'

const ALL_LAYERS: LayerInfo[] = [
  { id: 'jiegou',    label: '户型结构', color: '#6b5d4f', description: '房间布局与门窗位置' },
  { id: 'bagua',     label: '八卦方位', color: '#b8860b', description: '乾坎艮震巽离坤兑八卦分区' },
  { id: 'feixing',   label: '九宫飞星', color: '#c41e3a', description: '山星·向星·运星组合' },
  { id: 'xingsha',   label: '形煞标注', color: '#e07b39', description: '路冲/反弓/天斩等外部形煞' },
  { id: 'caifang',   label: '财位吉凶', color: '#2d5016', description: '财位/桃花位/文昌位/病位' },
]

interface FloorplanViewerProps {
  imageBase64: string
  points: FengshuiPoint[]
  flyingStar?: FlyingStarChart
  floorplan?: FloorplanResult
  geoFeatures?: {
    waterFeatures: { name: string; direction: string; distance: number; severity: string; fengshuiImpact: string }[]
    roadFeatures: { name: string; direction: string; distance: number; severity: string; fengshuiImpact: string }[]
    buildingFeatures: { name: string; direction: string; distance: number; severity: string; fengshuiImpact: string }[]
    specialFeatures: { name: string; direction: string; distance: number; severity: string; fengshuiImpact: string }[]
  }
  onPointClick: (point: FengshuiPoint) => void
}

const TYPE_COLORS: Record<string, string> = {
  living: '#f5e6d3',
  bedroom: '#e8f4ea',
  kitchen: '#fff3e0',
  bathroom: '#e3f2fd',
  balcony: '#f3e5f5',
  corridor: '#eceff1',
  study: '#e0f7fa',
  other: '#fafafa',
}

export default function FloorplanViewer({
  imageBase64,
  points,
  flyingStar,
  floorplan,
  geoFeatures,
  onPointClick,
}: FloorplanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [activeLayers, setActiveLayers] = useState<Set<LayerType>>(
    new Set<LayerType>(['jiegou', 'bagua', 'feixing', 'xingsha', 'caifang'])
  )

  const canvasWidth = floorplan?.canvasWidth ?? 600
  const canvasHeight = floorplan?.canvasHeight ?? 500

  const gridRotation = useMemo(() => {
    if (!flyingStar) return 0
    const rotations: Record<string, number> = {
      '子': 0, '癸': 0, '丑': 22.5, '艮': 45, '寅': 67.5,
      '甲': 90, '卯': 90, '乙': 90, '辰': 112.5, '巽': 135,
      '巳': 157.5, '丙': 180, '午': 180, '丁': 180, '未': 202.5,
      '坤': 225, '申': 247.5, '庚': 270, '酉': 270, '辛': 270,
      '戌': 292.5, '乾': 315, '亥': 337.5,
    }
    return rotations[flyingStar.facing] ?? 0
  }, [flyingStar])

  const toggleLayer = (id: LayerType) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const filteredPoints = useMemo(
    () => points.filter(p => !p.layer || activeLayers.has(p.layer)),
    [points, activeLayers]
  )

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3))
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5))
  const handleReset = () => { setScale(1); setOffset({ x: 0, y: 0 }) }
  const handleFullscreen = () => setIsFullscreen(f => !f)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }, [offset])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])
  const handleMouseUp = () => setIsDragging(false)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => Math.max(0.5, Math.min(3, s - e.deltaY * 0.001)))
  }, [])

  const geoFeatureList = useMemo(() => {
    if (!geoFeatures) return []
    return [
      ...(geoFeatures.waterFeatures || []),
      ...(geoFeatures.roadFeatures || []),
      ...(geoFeatures.buildingFeatures || []),
      ...(geoFeatures.specialFeatures || []),
    ]
  }, [geoFeatures])

  const polygonPath = (pts: Point[]): string => {
    if (pts.length === 0) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  }

  const getRoomCenter = (pts: Point[]): Point => {
    let cx = 0, cy = 0
    for (const p of pts) { cx += p.x; cy += p.y }
    return { x: cx / pts.length, y: cy / pts.length }
  }

  const containerStyle = isFullscreen ? {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 9999,
    background: '#f0ebe3',
  } : {}

  return (
    <div className="paper-card rounded-xl overflow-hidden" style={containerStyle}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {ALL_LAYERS.map(layer => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeLayers.has(layer.id)
                  ? 'border-current text-white font-medium'
                  : 'border-border text-ink-light hover:border-current'
              }`}
              style={{
                borderColor: activeLayers.has(layer.id) ? layer.color : undefined,
                backgroundColor: activeLayers.has(layer.id) ? layer.color : 'transparent',
              }}
              title={layer.description}
            >
              {layer.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <PointLegend points={filteredPoints} />
          <button onClick={handleFullscreen} className="text-xs px-2 py-1 border border-border rounded hover:bg-paper ink-light">
            {isFullscreen ? '退出全屏' : '全屏'}
          </button>
          <button onClick={handleZoomOut} className="w-7 h-7 flex items-center justify-center rounded border border-border text-ink-light hover:bg-paper text-sm">−</button>
          <span className="text-xs ink-light w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="w-7 h-7 flex items-center justify-center rounded border border-border text-ink-light hover:bg-paper text-sm">+</button>
          <button onClick={handleReset} className="text-xs ink-light hover:text-ink ml-1">重置</button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden bg-[#f0ebe3] select-none"
        style={{ height: isFullscreen ? 'calc(100vh - 48px)' : 'min(60vh, 600px)' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="absolute"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
        >
          <svg
            width={canvasWidth}
            height={canvasHeight}
            className="bg-white"
          >
            {floorplan?.rooms && activeLayers.has('jiegou') && floorplan.rooms.map((room, i) => {
              const pts: Point[] = room.points && room.points.length > 0
                ? room.points.map(p => ({ x: p.x * canvasWidth, y: p.y * canvasHeight }))
                : [
                    { x: room.bounds.x * canvasWidth, y: room.bounds.y * canvasHeight },
                    { x: (room.bounds.x + room.bounds.width) * canvasWidth, y: room.bounds.y * canvasHeight },
                    { x: (room.bounds.x + room.bounds.width) * canvasWidth, y: (room.bounds.y + room.bounds.height) * canvasHeight },
                    { x: room.bounds.x * canvasWidth, y: (room.bounds.y + room.bounds.height) * canvasHeight },
                  ]
              return (
                <g key={i}>
                  <path
                    d={polygonPath(pts)}
                    fill={TYPE_COLORS[room.type] || TYPE_COLORS.other}
                    stroke="#6b5d4f"
                    strokeWidth={1.5}
                  />
                  <text
                    x={getRoomCenter(pts).x}
                    y={getRoomCenter(pts).y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={12}
                    fill="#3d2914"
                    fontWeight="bold"
                    style={{ userSelect: 'none' }}
                  >
                    {room.name.length > 6 ? room.name.substring(0, 6) : room.name}
                  </text>
                </g>
              )
            })}

            {activeLayers.has('feixing') && flyingStar && (
              <NinePalaceGridSVG
                width={canvasWidth}
                height={canvasHeight}
                flyingStar={flyingStar}
                rotation={gridRotation}
              />
            )}

            {activeLayers.has('bagua') && flyingStar && (
              <BaguaOverlaySVG
                width={canvasWidth}
                height={canvasHeight}
                flyingStar={flyingStar}
                rotation={gridRotation}
              />
            )}

            {activeLayers.has('xingsha') && geoFeatureList.length > 0 && (
              <GeoFeaturesSVG features={geoFeatureList} width={canvasWidth} height={canvasHeight} />
            )}
          </svg>

          {activeLayers.has('caifang') && (
            <PointMarkers points={filteredPoints} imageWidth={canvasWidth} imageHeight={canvasHeight} onPointClick={onPointClick} />
          )}
        </div>

        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-ink-light">暂无风水点位标注</p>
          </div>
        )}
      </div>
    </div>
  )
}

function NinePalaceGridSVG({
  width, height, flyingStar, rotation,
}: {
  width: number; height: number
  flyingStar: FlyingStarChart
  rotation: number
}) {
  const cellW = width / 3
  const cellH = height / 3
  const cx = width / 2
  const cy = height / 2

  const LUOSHU_CELLS = [[9, 0, 0], [2, 0, 2], [3, 1, 0], [5, 1, 1], [7, 1, 2], [8, 2, 0], [1, 2, 1], [4, 2, 2]]

  const rotatePoint = (px: number, py: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = px - cx
    const dy = py - cy
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
  }

  return (
    <>
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cellW} y1={0} x2={cellW} y2={height} stroke="#c41e3a" strokeWidth={1} strokeOpacity={0.2} />
        <line x1={cellW * 2} y1={0} x2={cellW * 2} y2={height} stroke="#c41e3a" strokeWidth={1} strokeOpacity={0.2} />
        <line x1={0} y1={cellH} x2={width} y2={cellH} stroke="#c41e3a" strokeWidth={1} strokeOpacity={0.2} />
        <line x1={0} y1={cellH * 2} x2={width} y2={cellH * 2} stroke="#c41e3a" strokeWidth={1} strokeOpacity={0.2} />
      </g>

      {LUOSHU_CELLS.map(([pos, row, col]) => {
        const palace = flyingStar?.palaces.find(p => p.position === pos)
        if (!palace) return null

        const unrotatedCX = col * cellW + cellW / 2
        const unrotatedCY = row * cellH + cellH / 2
        const rotated = rotatePoint(unrotatedCX, unrotatedCY, rotation)

        const starColor = (star: number) => {
          if (star === 9) return '#c41e3a'
          if (star === 8 || star === 1) return '#2d5016'
          if (star === 2 || star === 5) return '#c41e3a'
          return '#6b5d4f'
        }

        return (
          <g key={pos} transform={`translate(${rotated.x - 30}, ${rotated.y - 20})`}>
            <rect x={0} y={0} width={60} height={40} fill="rgba(255,255,255,0.65)" rx={3} stroke="#c41e3a" strokeWidth={0.5} strokeOpacity={0.3} />
            <text
              x={30} y={12}
              textAnchor="middle" fontSize={16} fontWeight="bold"
              fill={starColor(palace.periodStar)}
            >
              {palace.periodStar}
            </text>
            <text
              x={30} y={25}
              textAnchor="middle" fontSize={9}
              fill="#6b5d4f"
            >
              山{palace.mountainStar} 向{palace.waterStar}
            </text>
            <text
              x={30} y={36}
              textAnchor="middle" fontSize={7} fill="#8b7355"
            >
              {palace.interpretation.substring(0, 6)}
            </text>
          </g>
        )
      })}
    </>
  )
}

function BaguaOverlaySVG({
  width, height, flyingStar, rotation,
}: {
  width: number; height: number
  flyingStar: FlyingStarChart
  rotation: number
}) {
  const cellW = width / 3
  const cellH = height / 3
  const cx = width / 2
  const cy = height / 2

  const LUOSHU_CELLS = [[9, 0, 0], [2, 0, 2], [3, 1, 0], [5, 1, 1], [7, 1, 2], [8, 2, 0], [1, 2, 1], [4, 2, 2]]

  const rotatePoint = (px: number, py: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = px - cx
    const dy = py - cy
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
  }

  const trigramSymbols: Record<string, string> = {
    '乾': '☰', '兑': '☱', '离': '☲', '震': '☳',
    '巽': '☴', '坎': '☵', '艮': '☶', '坤': '☷',
  }

  return (
    <>
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cellW} y1={0} x2={cellW} y2={height} stroke="#b8860b" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="8,4" />
        <line x1={cellW * 2} y1={0} x2={cellW * 2} y2={height} stroke="#b8860b" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="8,4" />
        <line x1={0} y1={cellH} x2={width} y2={cellH} stroke="#b8860b" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="8,4" />
        <line x1={0} y1={cellH * 2} x2={width} y2={cellH * 2} stroke="#b8860b" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="8,4" />
      </g>

      {LUOSHU_CELLS.map(([pos, row, col]) => {
        const palace = flyingStar?.palaces.find(p => p.position === pos)
        if (!palace) return null

        const unrotatedCX = col * cellW + cellW / 2
        const unrotatedCY = row * cellH + cellH / 2
        const rotated = rotatePoint(unrotatedCX, unrotatedCY, rotation)
        const symbol = trigramSymbols[palace.trigram] || palace.trigram

        return (
          <g key={`bagua-${pos}`} transform={`translate(${rotated.x}, ${rotated.y})`}>
            <circle r="22" fill="rgba(184,134,11,0.15)" stroke="#b8860b" strokeWidth={1.5} strokeOpacity={0.5} />
            <text
              y={-6}
              textAnchor="middle"
              fontSize={18}
              fontWeight="bold"
              fill="#b8860b"
              style={{ userSelect: 'none' }}
            >
              {symbol}
            </text>
            <text
              y={10}
              textAnchor="middle"
              fontSize={9}
              fill="#8b7355"
              style={{ userSelect: 'none' }}
            >
              {palace.trigram}{palace.direction}
            </text>
          </g>
        )
      })}

      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r="8" fill="#b8860b" fillOpacity={0.6} />
      </g>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="bold">{flyingStar.facing}</text>
    </>
  )
}

function GeoFeaturesSVG({
  features,
  width,
  height,
}: {
  features: { name: string; direction: string; distance: number; severity: string; fengshuiImpact: string }[]
  width: number
  height: number
}) {
  const directionToEdge = (dir: string): { x: number; y: number; edge: string } => {
    const map: Record<string, { x: number; y: number; edge: string }> = {
      '北': { x: 0.5, y: -0.05, edge: '上' },
      '东北': { x: 1.05, y: 0.25, edge: '右上' },
      '东': { x: 1.05, y: 0.5, edge: '右' },
      '东南': { x: 1.05, y: 0.75, edge: '右下' },
      '南': { x: 0.5, y: 1.05, edge: '下' },
      '西南': { x: -0.05, y: 0.75, edge: '左下' },
      '西': { x: -0.05, y: 0.5, edge: '左' },
      '西北': { x: -0.05, y: 0.25, edge: '左上' },
    }
    const result = map[dir] || { x: 0.5, y: 0.5, edge: '' }
    return {
      x: Math.max(10, Math.min(width - 10, result.x < 0 ? result.x * -width : result.x > 1 ? result.x * width : result.x * width)),
      y: Math.max(10, Math.min(height - 10, result.y < 0 ? result.y * -height : result.y > 1 ? result.y * height : result.y * height)),
      edge: result.edge,
    }
  }

  const severityColors: Record<string, string> = {
    danger: '#c41e3a',
    warning: '#e07b39',
    neutral: '#6b5d4f',
    good: '#2d5016',
  }

  return (
    <>
      {features.slice(0, 8).map((f, i) => {
        const { x, y, edge } = directionToEdge(f.direction)
        const color = severityColors[f.severity] || severityColors.neutral

        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            <rect x={-50} y={-15} width={100} height={30} fill="rgba(255,255,255,0.85)" stroke={color} strokeWidth={1.5} rx={4} />
            <text x={0} y={-3} textAnchor="middle" fontSize={8} fontWeight="bold" fill={color}>{f.name}</text>
            <text x={0} y={8} textAnchor="middle" fontSize={7} fill="#6b5d4f">{f.distance}米·{edge}</text>
          </g>
        )
      })}
    </>
  )
}
