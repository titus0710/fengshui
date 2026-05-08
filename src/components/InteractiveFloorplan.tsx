'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { EditableRoom, FloorplanCanvas, Point } from '@/lib/floorplan/editable'
import { addVertexToEdge, removeVertex, pointInPolygon } from '@/lib/floorplan/editable'

interface InteractiveFloorplanProps {
  canvas: FloorplanCanvas
  onCanvasChange: (canvas: FloorplanCanvas) => void
  onConfirm: (canvas: FloorplanCanvas) => void
  originalImageBase64?: string
}

type EditMode = 'select' | 'rect' | 'poly'
type DragMode = 'none' | 'move-room' | 'move-vertex' | 'resize-rect'

const VERTEX_SIZE = 12
const EDGE_HIT_DISTANCE = 15
const RESIZE_HIT = 12

function getBounds(pts: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function isRectangle(pts: Point[]): boolean {
  if (pts.length !== 4) return false
  const b = getBounds(pts)
  const eps = 2
  return pts.every(p =>
    (Math.abs(p.x - b.x) < eps || Math.abs(p.x - (b.x + b.width)) < eps) &&
    (Math.abs(p.y - b.y) < eps || Math.abs(p.y - (b.y + b.height)) < eps)
  )
}

function polygonPath(pts: Point[]): string {
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
}

function pointInSegment(p: Point, a: Point, b: Point, threshold: number): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y) < threshold
  let t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const proj = { x: a.x + t * dx, y: a.y + t * dy }
  return Math.hypot(p.x - proj.x, p.y - proj.y) < threshold
}

export default function InteractiveFloorplan({
  canvas,
  onCanvasChange,
  onConfirm,
  originalImageBase64,
}: InteractiveFloorplanProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<EditMode>('select')
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createStart, setCreateStart] = useState<Point | null>(null)
  const [createCurrent, setCreateCurrent] = useState<Point | null>(null)
  const [drag, setDrag] = useState<{
    mode: DragMode
    roomId: string
    vertexIndex?: number
    resizeDir?: 'nw' | 'ne' | 'sw' | 'se'
    startMouseX: number
    startMouseY: number
    startPoints: Point[]
  } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingNameId && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingNameId])

  const getSvgPoint = useCallback((clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const pt = svgRef.current.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse())
    return { x: svgP.x, y: svgP.y }
  }, [])

  const getRoomCenter = (room: EditableRoom): Point => {
    let cx = 0, cy = 0
    for (const p of room.points) { cx += p.x; cy += p.y }
    return { x: cx / room.points.length, y: cy / room.points.length }
  }

  const findVertexAt = (pt: Point, room: EditableRoom): number | null => {
    for (let i = 0; i < room.points.length; i++) {
      const vp = room.points[i]
      if (Math.hypot(vp.x - pt.x, vp.y - pt.y) < VERTEX_SIZE) return i
    }
    return null
  }

  const findEdgeAt = (pt: Point, room: EditableRoom): number | null => {
    for (let i = 0; i < room.points.length; i++) {
      const p1 = room.points[i]
      const p2 = room.points[(i + 1) % room.points.length]
      if (pointInSegment(pt, p1, p2, EDGE_HIT_DISTANCE)) return i
    }
    return null
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const pt = getSvgPoint(e.clientX, e.clientY)

    if (isCreatingRoom) {
      if (!createStart) {
        setCreateStart(pt)
        setCreateCurrent(pt)
      } else {
        const minX = Math.min(createStart.x, pt.x)
        const minY = Math.min(createStart.y, pt.y)
        const maxX = Math.max(createStart.x, pt.x)
        const maxY = Math.max(createStart.y, pt.y)
        const newRoom: EditableRoom = {
          id: `room-${Date.now()}`,
          name: `房间${canvas.rooms.length + 1}`,
          type: 'other',
          points: [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
          ],
          color: '#f5e6d3',
        }
        onCanvasChange({ ...canvas, rooms: [...canvas.rooms, newRoom] })
        setSelectedRoomId(newRoom.id)
        setIsCreatingRoom(false)
        setCreateStart(null)
        setCreateCurrent(null)
      }
      return
    }

    const currentRoom = canvas.rooms.find(r => r.id === selectedRoomId)

    if (currentRoom) {
      if (editMode === 'poly') {
        const vi = findVertexAt(pt, currentRoom)
        if (vi !== null) {
          e.stopPropagation()
          setDrag({ mode: 'move-vertex', roomId: currentRoom.id, vertexIndex: vi, startMouseX: pt.x, startMouseY: pt.y, startPoints: currentRoom.points.map(p => ({ ...p })) })
          return
        }
      }

      if (editMode === 'rect' && isRectangle(currentRoom.points)) {
        const b = getBounds(currentRoom.points)
        const corners: [string, number, number][] = [
          ['nw', b.x, b.y], ['ne', b.x + b.width, b.y],
          ['sw', b.x, b.y + b.height], ['se', b.x + b.width, b.y + b.height],
        ]
        for (const [dir, cx, cy] of corners) {
          if (Math.hypot(pt.x - cx, pt.y - cy) < RESIZE_HIT + 4) {
            e.stopPropagation()
            setDrag({ mode: 'resize-rect', roomId: currentRoom.id, resizeDir: dir as 'nw' | 'ne' | 'sw' | 'se', startMouseX: pt.x, startMouseY: pt.y, startPoints: currentRoom.points.map(p => ({ ...p })) })
            return
          }
        }
      }

      if (pointInPolygon(pt, currentRoom.points)) {
        e.stopPropagation()
        setDrag({ mode: 'move-room', roomId: currentRoom.id, startMouseX: pt.x, startMouseY: pt.y, startPoints: currentRoom.points.map(p => ({ ...p })) })
        return
      }
    }

    for (let i = canvas.rooms.length - 1; i >= 0; i--) {
      const room = canvas.rooms[i]
      if (pointInPolygon(pt, room.points)) {
        setSelectedRoomId(room.id)
        setDrag({ mode: 'move-room', roomId: room.id, startMouseX: pt.x, startMouseY: pt.y, startPoints: room.points.map(p => ({ ...p })) })
        return
      }
    }
    setSelectedRoomId(null)
  }, [canvas.rooms, selectedRoomId, editMode, getSvgPoint, isCreatingRoom, createStart, createCurrent, onCanvasChange])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drag && !isCreatingRoom) return
    const pt = getSvgPoint(e.clientX, e.clientY)

    if (isCreatingRoom && createStart) {
      setCreateCurrent(pt)
      return
    }

    if (!drag) return
    const dx = pt.x - drag.startMouseX
    const dy = pt.y - drag.startMouseY

    if (drag.mode === 'move-room') {
      const newPts = drag.startPoints.map(p => ({ x: p.x + dx, y: p.y + dy }))
      onCanvasChange({ ...canvas, rooms: canvas.rooms.map(r => r.id === drag.roomId ? { ...r, points: newPts } : r) })
    } else if (drag.mode === 'move-vertex' && drag.vertexIndex !== undefined) {
      const newPts = drag.startPoints.map((p, i) => i === drag.vertexIndex ? { x: drag.startPoints[drag.vertexIndex].x + dx, y: drag.startPoints[drag.vertexIndex].y + dy } : { ...p })
      onCanvasChange({ ...canvas, rooms: canvas.rooms.map(r => r.id === drag.roomId ? { ...r, points: newPts } : r) })
    } else if (drag.mode === 'resize-rect' && drag.resizeDir) {
      const op = drag.startPoints
      const b0 = getBounds(op)
      const newX = pt.x
      const newY = pt.y

      let newMinX: number, newMaxX: number, newMinY: number, newMaxY: number

      if (drag.resizeDir === 'se') {
        newMinX = b0.x
        newMinY = b0.y
        newMaxX = newX
        newMaxY = newY
      } else if (drag.resizeDir === 'sw') {
        newMinX = newX
        newMinY = b0.y
        newMaxX = b0.x + b0.width
        newMaxY = newY
      } else if (drag.resizeDir === 'ne') {
        newMinX = b0.x
        newMinY = newY
        newMaxX = newX
        newMaxY = b0.y + b0.height
      } else {
        newMinX = newX
        newMinY = newY
        newMaxX = b0.x + b0.width
        newMaxY = b0.y + b0.height
      }

      const newPts: Point[] = [
        { x: newMinX, y: newMinY },
        { x: newMaxX, y: newMinY },
        { x: newMaxX, y: newMaxY },
        { x: newMinX, y: newMaxY },
      ]
      onCanvasChange({ ...canvas, rooms: canvas.rooms.map(r => r.id === drag.roomId ? { ...r, points: newPts } : r) })
    }
  }, [drag, canvas, getSvgPoint, onCanvasChange, isCreatingRoom, createStart])

  const handleMouseUp = useCallback(() => setDrag(null), [])

  const handleDoubleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (editMode !== 'poly') return
    e.stopPropagation()
    const pt = getSvgPoint(e.clientX, e.clientY)
    const currentRoom = canvas.rooms.find(r => r.id === selectedRoomId)
    if (!currentRoom) return

    const ei = findEdgeAt(pt, currentRoom)
    if (ei !== null) {
      const p1 = currentRoom.points[ei]
      const p2 = currentRoom.points[(ei + 1) % currentRoom.points.length]
      const newRoom = addVertexToEdge(currentRoom, ei, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 })
      onCanvasChange({ ...canvas, rooms: canvas.rooms.map(r => r.id === selectedRoomId ? newRoom : r) })
    }
  }, [canvas, selectedRoomId, editMode, getSvgPoint, onCanvasChange])

  const handleVertexRightClick = useCallback((e: React.MouseEvent, roomId: string, vi: number) => {
    e.preventDefault()
    e.stopPropagation()
    const room = canvas.rooms.find(r => r.id === roomId)
    if (room && room.points.length > 3) {
      const newRoom = removeVertex(room, vi)
      onCanvasChange({ ...canvas, rooms: canvas.rooms.map(r => r.id === roomId ? newRoom : r) })
    }
  }, [canvas, onCanvasChange])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold ink-text">📐 户型图确认</h2>
        <p className="text-xs ink-light">
          {isCreatingRoom && !createStart && '点击画布确定起始点'}
          {isCreatingRoom && createStart && '移动鼠标预览，再次点击完成绘制'}
          {!isCreatingRoom && editMode === 'select' && '点击选择房间 | 拖动移动'}
          {!isCreatingRoom && editMode === 'rect' && '矩形模式：四角调整大小 | 拖动内部移动'}
          {!isCreatingRoom && editMode === 'poly' && '异型模式：顶点拖动 | 双击边添加点 | 右键删除点'}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-2">
        {(['select', 'rect', 'poly'] as EditMode[]).map(m => (
          <button key={m} onClick={() => { setEditMode(m); setIsCreatingRoom(false); setCreateStart(null); setCreateCurrent(null) }}
            className={`px-3 py-1.5 rounded text-sm border ${editMode === m && !isCreatingRoom ? 'bg-accent text-white border-accent' : 'border-border ink-light hover:bg-paper'}`}>
            {m === 'select' ? '📦 选择' : m === 'rect' ? '⬜ 矩形' : '🔷 异型'}
          </button>
        ))}
        <div className="w-px h-6 bg-border mx-1" />
        <button
          onClick={() => { setIsCreatingRoom(!isCreatingRoom); setEditMode('select'); setCreateStart(null); setCreateCurrent(null) }}
          className={`px-3 py-1.5 rounded text-sm border ${isCreatingRoom ? 'bg-green-600 text-white border-green-600' : 'border-border ink-light hover:bg-paper text-green-700'}`}>
          ➕ 添加房间
        </button>
      </div>

      <div className="relative bg-white border-2 border-border rounded-xl overflow-hidden" style={{ width: canvas.width, height: canvas.height }}>
        {originalImageBase64 && (
          <img
            src={`data:image/jpeg;base64,${originalImageBase64}`}
            alt="原始户型图"
            className="absolute inset-0 w-full h-full object-contain opacity-30 pointer-events-none"
            style={{ pointerEvents: 'none' }}
          />
        )}

        <svg ref={svgRef} width={canvas.width} height={canvas.height}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}
          className="relative z-10 cursor-default">

          {canvas.rooms.map(room => {
            const isSelected = room.id === selectedRoomId
            const pts = room.points
            const b = getBounds(pts)
            const isRect = isRectangle(pts) && editMode === 'rect'

            return (
              <g key={room.id}>
                <path d={polygonPath(pts)} fill={room.color} stroke={isSelected ? '#b8860b' : '#6b5d4f'} strokeWidth={isSelected ? 2.5 : 1.5} />

                {isSelected && editMode === 'poly' && pts.map((p, i) => (
                  <g key={i}>
                    <rect x={p.x - VERTEX_SIZE / 2} y={p.y - VERTEX_SIZE / 2} width={VERTEX_SIZE} height={VERTEX_SIZE}
                      fill="#b8860b" stroke="white" strokeWidth={1.5} rx={2} className="cursor-pointer"
                      onMouseDown={(e) => { e.stopPropagation(); setDrag({ mode: 'move-vertex', roomId: room.id, vertexIndex: i, startMouseX: getSvgPoint(e.clientX, e.clientY).x, startMouseY: getSvgPoint(e.clientX, e.clientY).y, startPoints: room.points.map(p => ({ ...p })) }) }}
                      onContextMenu={(e) => handleVertexRightClick(e, room.id, i)} />
                    {i > 0 && <line x1={pts[i - 1].x} y1={pts[i - 1].y} x2={p.x} y2={p.y} stroke="#b8860b" strokeWidth={2} opacity={0.3} />}
                  </g>
                ))}
                {isSelected && editMode === 'poly' && pts.length > 0 && <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={pts[0].x} y2={pts[0].y} stroke="#b8860b" strokeWidth={2} opacity={0.3} />}

                {isSelected && isRect && (() => {
                  const corners: [string, number, number][] = [['nw', b.x, b.y], ['ne', b.x + b.width, b.y], ['sw', b.x, b.y + b.height], ['se', b.x + b.width, b.y + b.height]]
                  return corners.map(([dir, cx, cy]) => (
                    <rect key={dir} x={cx - 5} y={cy - 5} width={10} height={10} fill="#b8860b" stroke="white" strokeWidth={1} rx={2}
                      className="cursor-pointer" style={{ cursor: dir === 'nw' || dir === 'se' ? 'nwse-resize' : 'nesw-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); setDrag({ mode: 'resize-rect', roomId: room.id, resizeDir: dir as 'nw' | 'ne' | 'sw' | 'se', startMouseX: getSvgPoint(e.clientX, e.clientY).x, startMouseY: getSvgPoint(e.clientX, e.clientY).y, startPoints: room.points.map(p => ({ ...p })) }) }} />
                  ))
                })()}

                <text x={getRoomCenter(room).x} y={getRoomCenter(room).y} textAnchor="middle" dominantBaseline="middle"
                  fontSize={12} fill="#3d2914" fontWeight="bold" pointerEvents="none" style={{ userSelect: 'none' }}>
                  {room.name.length > 6 ? room.name.substring(0, 6) : room.name}
                </text>
              </g>
            )
          })}

          {isCreatingRoom && createStart && createCurrent && (
            <rect
              x={Math.min(createStart.x, createCurrent.x)}
              y={Math.min(createStart.y, createCurrent.y)}
              width={Math.abs(createCurrent.x - createStart.x)}
              height={Math.abs(createCurrent.y - createStart.y)}
              fill="#f5e6d3"
              stroke="#b8860b"
              strokeWidth={2}
              strokeDasharray="5,5"
              opacity={0.7}
            />
          )}
        </svg>
      </div>

      {canvas.rooms.find(r => r.id === selectedRoomId) && !editingNameId && (
        <div className="flex items-center gap-3 bg-paper border border-border rounded-lg px-4 py-2">
          <span className="text-sm ink-text font-medium">{canvas.rooms.find(r => r.id === selectedRoomId)!.name}</span>
          <span className="text-xs ink-light">({canvas.rooms.find(r => r.id === selectedRoomId)!.points.length}个顶点{!isRectangle(canvas.rooms.find(r => r.id === selectedRoomId)!.points) && editMode === 'rect' ? '，非矩形，仅可移动' : ''})</span>
          <button onClick={() => setEditingNameId(selectedRoomId)} className="text-xs text-accent hover:text-accent-dark underline">重命名</button>
          <button onClick={() => { onCanvasChange({ ...canvas, rooms: canvas.rooms.filter(r => r.id !== selectedRoomId) }); setSelectedRoomId(null) }} className="text-xs text-accent-red hover:text-red-700 underline">删除</button>
        </div>
      )}

      {editingNameId && (
        <div className="flex items-center gap-3 bg-paper border border-border rounded-lg px-4 py-2">
          <span className="text-sm ink-text">重命名：</span>
          <input
            ref={nameInputRef}
            type="text"
            defaultValue={canvas.rooms.find(r => r.id === editingNameId)?.name || ''}
            onBlur={(e) => {
              const newName = e.target.value.trim()
              if (newName && editingNameId) {
                onCanvasChange({ ...canvas, rooms: canvas.rooms.map(r => r.id === editingNameId ? { ...r, name: newName } : r) })
              }
              setEditingNameId(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditingNameId(null)
            }}
            className="px-2 py-1 border border-accent rounded text-sm ink-text bg-white"
          />
        </div>
      )}

      <button onClick={() => onConfirm(canvas)} className="btn-primary px-8 py-3 text-base">✅ 确认户型图，开始分析</button>
    </div>
  )
}
