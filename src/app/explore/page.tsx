'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AnalysisResult, FengshuiPoint, ChatMessage } from '@/lib/types'
import FloorplanViewer from '@/components/FloorplanViewer'
import AnalysisPanel from '@/components/AnalysisPanel'
import PointDetail from '@/components/PointDetail'
import ChatPanel from '@/components/ChatPanel'

export default function ExplorePage() {
  const router = useRouter()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<FengshuiPoint | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResult')
    if (!stored) {
      router.push('/')
      return
    }
    try {
      setResult(JSON.parse(stored))
    } catch {
      router.push('/')
    }
  }, [router])

  const handleGeneratePdf = useCallback(async () => {
    if (!result) return
    setIsGeneratingPdf(true)
    setPdfError('')

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, messages: chatMessages }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'PDF 生成失败')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `风水评估报告_${result.geo.address || 'report'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF 生成失败，请稍后重试')
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [result, chatMessages])

  const handleNewAnalysis = () => {
    sessionStorage.removeItem('analysisResult')
    router.push('/')
  }

  if (!result) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
          <p className="ink-light">加载分析结果...</p>
        </div>
      </main>
    )
  }

  const { floorplan, fengshui } = result

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold ink-text">🏠 风水评估结果</h1>
            <p className="text-xs ink-light">{result.geo.address}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleNewAnalysis}
              className="text-sm ink-light hover:text-ink transition-colors"
            >
              重新评估
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isGeneratingPdf ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  生成中...
                </>
              ) : (
                '📥 生成 PDF 报告'
              )}
            </button>
          </div>
        </div>
        {pdfError && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm text-center">
            {pdfError}
          </div>
        )}
      </header>

      <div className="flex-1 max-w-[1800px] mx-auto w-full p-4">
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 140px)' }}>
          {/* 左侧：户型图 */}
          <div className="lg:w-[55%]">
            <FloorplanViewer
              imageBase64={floorplan.imageBase64}
              points={fengshui.points}
              flyingStar={fengshui.flyingStar}
              floorplan={floorplan}
              geoFeatures={{
                waterFeatures: result.geo.waterFeatures,
                roadFeatures: result.geo.roadFeatures,
                buildingFeatures: result.geo.buildingFeatures,
                specialFeatures: result.geo.specialFeatures,
              }}
              onPointClick={setSelectedPoint}
            />

            {/* 点位快捷列表 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {fengshui.points.map((point) => (
                <button
                  key={point.id}
                  onClick={() => setSelectedPoint(point)}
                  className="text-xs px-3 py-1.5 bg-white border border-border rounded-full hover:border-accent hover:text-accent transition-colors ink-light"
                >
                  {point.label}
                </button>
              ))}
            </div>
          </div>

          {/* 右侧面板 */}
          <div className="lg:w-[45%] space-y-4">
            <AnalysisPanel result={result} />
            <ChatPanel result={result} onMessagesChange={setChatMessages} />
          </div>
        </div>
      </div>

      {selectedPoint && (
        <PointDetail
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      )}
    </main>
  )
}
