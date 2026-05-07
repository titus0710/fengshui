'use client'

import { useState, useMemo } from 'react'
import type { FengshuiPoint } from '@/lib/types'

const severityConfig = {
  good: { bg: 'bg-green-100 border-green-300', text: 'text-accent-green', dot: 'bg-green-500', label: '吉' },
  neutral: { bg: 'bg-gray-100 border-gray-300', text: 'text-ink-light', dot: 'bg-gray-400', label: '平' },
  warning: { bg: 'bg-yellow-50 border-yellow-300', text: 'text-accent', dot: 'bg-yellow-500', label: '注意' },
  danger: { bg: 'bg-red-50 border-red-300', text: 'text-accent-red', dot: 'bg-red-500', label: '凶' },
}

const typeColors: Record<string, string> = {
  caifang: '#2d5016',
  xiongwei: '#c41e3a',
  taohua: '#e91e63',
  wenchang: '#1565c0',
  bingwei: '#7b1fa2',
  shasource: '#e07b39',
}

const typeDotStyles: Record<string, string> = {
  caifang: 'bg-gradient-to-br from-yellow-400 to-amber-600',
  xiongwei: 'bg-gradient-to-br from-red-500 to-red-700',
  taohua: 'bg-gradient-to-br from-pink-400 to-pink-600',
  wenchang: 'bg-gradient-to-br from-blue-400 to-blue-600',
  bingwei: 'bg-gradient-to-br from-purple-400 to-purple-700',
  shasource: 'bg-gradient-to-br from-orange-400 to-orange-600',
}

const typeEmoji: Record<string, string> = {
  caifang: '💰',
  xiongwei: '⚠️',
  taohua: '🌸',
  wenchang: '📚',
  bingwei: '🏥',
  shasource: '⚡',
}

export default function PointDetail({
  point,
  onClose,
}: {
  point: FengshuiPoint
  onClose: () => void
}) {
  const config = severityConfig[point.severity]
  const emoji = typeEmoji[point.type] || '📍'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className={`${config.bg} border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{emoji}</span>
            <div>
              <h3 className="text-lg font-bold ink-text">{point.label}</h3>
              {point.room && (
                <p className="text-sm ink-light">{point.room}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink transition-colors text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {point.element && (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-white rounded-full border border-border ink-light">
                五行：{point.element}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.text} font-medium`}>
                {config.label}
              </span>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium ink-text mb-1">解读</h4>
            <p className="text-sm ink-light leading-relaxed">{point.analysis}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium ink-text mb-1">建议</h4>
            <p className="text-sm accent-text leading-relaxed">💡 {point.suggestion}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PointMarkers({
  points,
  imageWidth,
  imageHeight,
  onPointClick,
}: {
  points: FengshuiPoint[]
  imageWidth: number
  imageHeight: number
  onPointClick: (point: FengshuiPoint) => void
}) {
  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => {
      const order: Record<string, number> = { danger: 0, warning: 1, neutral: 2, good: 3 }
      return (order[a.severity] ?? 1) - (order[b.severity] ?? 1)
    }),
    [points]
  )

  return (
    <>
      {sortedPoints.map((point) => {
        const dotStyle = typeDotStyles[point.type] || 'bg-gray-400'
        return (
          <button
            key={point.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
            }}
            onClick={() => onPointClick(point)}
            title={point.label}
          >
            <div
              className={`${dotStyle} w-5 h-5 rounded-full border-2 border-white shadow-lg group-hover:scale-125 transition-transform`}
              style={{ boxShadow: `0 0 8px ${typeColors[point.type] || '#666'}60` }}
            />
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-xs bg-white/90 text-ink px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm pointer-events-none">
              {point.label}
            </span>
          </button>
        )
      })}
    </>
  )
}

export function PointLegend({ points }: { points: FengshuiPoint[] }) {
  const typeStats = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>()
    points.forEach((p) => {
      const existing = map.get(p.type)
      if (existing) {
        existing.count++
      } else {
        map.set(p.type, { count: 1, color: typeColors[p.type] || '#666' })
      }
    })
    return Array.from(map.entries())
  }, [points])

  return (
    <div className="flex flex-wrap gap-2">
      {typeStats.map(([type, { count, color }]) => (
        <div
          key={type}
          className="flex items-center gap-1.5 text-xs ink-light bg-white/80 px-2 py-1 rounded-full"
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span>{typeEmoji[type] || '📍'}</span>
          <span>×{count}</span>
        </div>
      ))}
    </div>
  )
}
