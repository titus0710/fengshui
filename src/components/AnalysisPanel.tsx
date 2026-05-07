'use client'

import { useState } from 'react'
import type { AnalysisResult } from '@/lib/types'

export default function AnalysisPanel({ result }: { result: AnalysisResult }) {
  const { floorplan, geo, fengshui } = result

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    feixing: true,
    bagua: false,
    rooms: false,
    geo: false,
    report: false,
  })

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const roomsByType: Record<string, number> = {}
  floorplan.rooms.forEach((r) => {
    roomsByType[r.type] = (roomsByType[r.type] || 0) + 1
  })

  const typeLabel: Record<string, string> = {
    living: '客厅', bedroom: '卧室', kitchen: '厨房', bathroom: '卫生间',
    balcony: '阳台', corridor: '走廊', study: '书房', other: '其他',
  }

  return (
    <div className="paper-card rounded-xl p-4 space-y-3 fengshui-scrollbar overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
      <h2 className="text-lg font-bold ink-text">📋 玄空风水</h2>

      {fengshui.overview.overallScore !== undefined && (
        <div className="text-center py-3">
          <div className="text-3xl font-bold accent-text">{fengshui.overview.overallScore}</div>
          <div className="text-xs ink-light">综合评分</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-paper rounded-full ink-light">朝向：{floorplan.direction}</span>
        <span className="px-2 py-1 bg-paper rounded-full ink-light">形状：{floorplan.overallShape}</span>
        <span className="px-2 py-1 bg-paper rounded-full ink-light">共 {floorplan.rooms.length} 个区域</span>
      </div>

      {/* 九宫飞星盘 */}
      {fengshui.flyingStar && (
        <Section title="✨ 九宫飞星排盘" expanded={expandedSections.feixing} onToggle={() => toggleSection('feixing')}>
          <div className="mb-2 text-xs ink-light">
            {fengshui.flyingStar.sitting}山{fengshui.flyingStar.facing}向 · {fengshui.flyingStar.period}运
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[9, 2, null, 3, 5, 7, 8, 1, 4].map((pos, i) => {
              if (!pos) return <div key={i} />
              const p = fengshui.flyingStar?.palaces?.find(pal => pal.position === pos)
              if (!p) return <div key={i} className="bg-paper rounded p-1.5 text-center text-[10px] ink-light">—</div>

              const starStyle = (s: number) => {
                if (s === 9) return { color: '#c41e3a', weight: 'bold' as const }
                if (s === 8 || s === 1) return { color: '#2d5016', weight: 'bold' as const }
                if (s === 2 || s === 5) return { color: '#c41e3a', weight: 'normal' as const }
                return { color: '#6b5d4f', weight: 'normal' as const }
              }

              const s1 = starStyle(p.periodStar)
              const s2 = starStyle(p.mountainStar)
              const s3 = starStyle(p.waterStar)

              return (
                <div key={i} className="bg-paper rounded p-1.5 text-center">
                  <div className="text-[10px] font-bold" style={{ color: '#b8860b' }}>{p.trigram} {p.direction}</div>
                  <div className="text-[9px] leading-tight">
                    运<span style={s1}>{p.periodStar}</span>{' '}
                    山<span style={s2}>{p.mountainStar}</span>{' '}
                    向<span style={s3}>{p.waterStar}</span>
                  </div>
                  <div className="text-[8px] mt-0.5 ink-light">{p.interpretation}</div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* 八卦方位 */}
      <Section title="☯ 八卦方位" expanded={expandedSections.bagua} onToggle={() => toggleSection('bagua')}>
        <p className="text-sm ink-light leading-relaxed">{fengshui.overview.bagua}</p>
      </Section>

      {/* 房间列表 */}
      <Section title="🏠 户型结构" expanded={expandedSections.rooms} onToggle={() => toggleSection('rooms')}>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(roomsByType).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between bg-paper px-3 py-2 rounded-lg">
              <span className="text-sm ink-text">{typeLabel[type] || type}</span>
              <span className="text-xs ink-light">×{count}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {floorplan.rooms.map((room, i) => (
            <div key={i} className="text-xs ink-light flex justify-between">
              <span>{room.name}</span>
              {room.notes && <span className="text-ink truncate ml-2 max-w-[60%]">{room.notes}</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* 地理环境 */}
      <Section title="🗺 地理风水环境" expanded={expandedSections.geo} onToggle={() => toggleSection('geo')}>
        <p className="text-xs ink-light mb-2">{geo.address}</p>

        <div className="mb-2 text-xs ink-light bg-paper px-2 py-1.5 rounded">
          {geo.terrain.description}
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {geo.terrain.hasWaterNearby && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">💧 近水</span>}
          {geo.terrain.hasHighwayNearby && <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full">🛣 近高速</span>}
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-ink-light rounded-full">建筑密度：{geo.terrain.buildingDensity}</span>
        </div>

        {geo.waterFeatures.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] font-medium text-blue-700 mb-1">💧 水系</div>
            {geo.waterFeatures.map((f, i) => (
              <div key={i} className="text-[10px] ink-light bg-blue-50/50 px-2 py-1 rounded mb-1">
                <span className="font-medium">{f.description}</span>
                <div>{f.fengshuiImpact}</div>
              </div>
            ))}
          </div>
        )}

        {geo.roadFeatures.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] font-medium text-orange-700 mb-1">🛣 道路</div>
            {geo.roadFeatures.map((f, i) => (
              <div key={i} className="text-[10px] ink-light bg-orange-50/50 px-2 py-1 rounded mb-1">
                <span className="font-medium">{f.description}</span>
                <div>{f.fengshuiImpact}</div>
              </div>
            ))}
          </div>
        )}

        {geo.buildingFeatures.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] font-medium text-ink mb-1">🏢 大型建筑</div>
            {geo.buildingFeatures.map((f, i) => (
              <div key={i} className="text-[10px] ink-light bg-gray-50 px-2 py-1 rounded mb-1">
                <span className="font-medium">{f.description}</span>
                <div>{f.fengshuiImpact}</div>
              </div>
            ))}
          </div>
        )}

        {geo.specialFeatures.length > 0 ? (
          <div>
            <div className="text-[10px] font-medium text-accent-red mb-1">⚠️ 需关注场所</div>
            {geo.specialFeatures.map((f, i) => (
              <div key={i} className={`text-[10px] ink-light px-2 py-1 rounded mb-1 ${
                f.severity === 'danger' ? 'bg-red-50' : 'bg-yellow-50'
              }`}>
                <span className="font-medium">{f.description}</span>
                <div>{f.fengshuiImpact}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs ink-light">未发现需特别关注的特殊场所</p>
        )}
      </Section>

      {/* 报告摘要 */}
      <Section title="📝 报告摘要" expanded={expandedSections.report} onToggle={() => toggleSection('report')}>
        <p className="text-sm ink-light leading-relaxed">{fengshui.overview.summary}</p>
      </Section>
    </div>
  )
}

function Section({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 bg-paper hover:bg-paper-dark transition-colors text-left">
        <span className="text-sm font-medium ink-text">{title}</span>
        <span className={`text-xs ink-light transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {expanded && <div className="px-3 py-2 border-t border-border">{children}</div>}
    </div>
  )
}
