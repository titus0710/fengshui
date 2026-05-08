'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { TwentyFourMountain } from '@/lib/types'
import type { FloorplanCanvas } from '@/lib/floorplan/editable'
import AddressSelector from '@/components/AddressSelector'
import InteractiveFloorplan from '@/components/InteractiveFloorplan'
import { qwenRoomsToEditable } from '@/lib/floorplan/editable'

type Step = 'upload' | 'floorplan-confirm' | 'direction' | 'analyzing'

const MOUNTAINS: { label: string; value: TwentyFourMountain; degree: number }[] = [
  { label: '子 (正北 0°)', value: '子', degree: 0 },
  { label: '癸 (北偏东 15°)', value: '癸', degree: 15 },
  { label: '丑 (东北偏北 30°)', value: '丑', degree: 30 },
  { label: '艮 (东北 45°)', value: '艮', degree: 45 },
  { label: '寅 (东北偏东 60°)', value: '寅', degree: 60 },
  { label: '甲 (东偏北 75°)', value: '甲', degree: 75 },
  { label: '卯 (正东 90°)', value: '卯', degree: 90 },
  { label: '乙 (东偏南 105°)', value: '乙', degree: 105 },
  { label: '辰 (东南偏东 120°)', value: '辰', degree: 120 },
  { label: '巽 (东南 135°)', value: '巽', degree: 135 },
  { label: '巳 (东南偏南 150°)', value: '巳', degree: 150 },
  { label: '丙 (南偏东 165°)', value: '丙', degree: 165 },
  { label: '午 (正南 180°)', value: '午', degree: 180 },
  { label: '丁 (南偏西 195°)', value: '丁', degree: 195 },
  { label: '未 (西南偏南 210°)', value: '未', degree: 210 },
  { label: '坤 (西南 225°)', value: '坤', degree: 225 },
  { label: '申 (西南偏西 240°)', value: '申', degree: 240 },
  { label: '庚 (西偏南 255°)', value: '庚', degree: 255 },
  { label: '酉 (正西 270°)', value: '酉', degree: 270 },
  { label: '辛 (西偏北 285°)', value: '辛', degree: 285 },
  { label: '戌 (西北偏西 300°)', value: '戌', degree: 300 },
  { label: '乾 (西北 315°)', value: '乾', degree: 315 },
  { label: '亥 (西北偏北 330°)', value: '亥', degree: 330 },
  { label: '壬 (北偏西 345°)', value: '壬', degree: 345 },
]

type ApiErrorPayload = {
  error?: string
}

type RecognizeResponse = {
  rooms: { name: string; type: string; bounds: { x: number; y: number; width: number; height: number }; notes: string }[]
  direction: string
  overallShape: string
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  const trimmed = raw.trim()

  const tryParseJson = () => {
    if (!trimmed) return null
    if (!contentType.includes('application/json') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null
    }

    try {
      return JSON.parse(trimmed) as T
    } catch {
      return null
    }
  }

  const parsed = tryParseJson()
  if (parsed) {
    if (!response.ok) {
      const message = (parsed as ApiErrorPayload).error || fallbackMessage
      throw new Error(message)
    }
    return parsed
  }

  const looksLikeHtml =
    contentType.includes('text/html') ||
    /^<!doctype html>/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed)

  if (looksLikeHtml) {
    throw new Error('接口返回了 HTML 页面而不是 JSON。请确认当前打开的是风水项目开发地址（通常为 localhost:3100），而不是其他占用 localhost:3000 的应用。')
  }

  const preview = trimmed.replace(/\s+/g, ' ').slice(0, 160)
  throw new Error(preview || fallbackMessage)
}

export default function HomePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')

  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [imageBase64, setImageBase64] = useState<string>('')
  const [address, setAddress] = useState('')
  const [editableCanvas, setEditableCanvas] = useState<FloorplanCanvas | null>(null)

  // 方向确认：向方就是窗户/阳台对着的方向
  const [facingDirection, setFacingDirection] = useState<TwentyFourMountain>('午')
  const [autoDetectedDir, setAutoDetectedDir] = useState('')

  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setError('请上传图片文件'); return }
    if (file.size > 10 * 1024 * 1024) { setError('图片大小不能超过 10MB'); return }
    setError('')
    setImage(file)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const result = e.target?.result as string
      setImagePreview(result)
      const base64 = result.split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleImageSelect(file)
  }, [handleImageSelect])

  // Step 1 → 2: 调用 Qwen 识别户型图，进入户型图确认步骤
  const handleToFloorplanConfirm = async () => {
    if (!image || !address.trim()) {
      setError('请上传户型图并输入小区地址')
      return
    }
    setError('')
    setStep('floorplan-confirm')
    setProgress('正在识别户型结构...')

    try {
      const formData = new FormData()
      formData.append('image', image)

      const response = await fetch('/api/recognize', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const data = await parseApiResponse<RecognizeResponse>(response, '户型图识别失败')

      const canvas = qwenRoomsToEditable(data.rooms, 600, 500)
      setEditableCanvas(canvas)
      setProgress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别服务异常')
      setStep('upload')
    }
  }

  // Step 2 → 3: 户型图确认后，进入方向确认
  const handleFloorplanConfirm = (canvas: FloorplanCanvas) => {
    setEditableCanvas(canvas)
    setStep('direction')
  }

  // Step 3 → 4: 确认方向后开始完整分析
  const handleStartAnalyze = async () => {
    if (!image || !address.trim() || !editableCanvas) return
    setStep('analyzing')
    setError('')
    setProgress('正在分析...')

    try {
      const formData = new FormData()
      formData.append('image', image)
      formData.append('address', address.trim())
      formData.append('facing', facingDirection)
      formData.append('period', '9')
      formData.append('canvas', JSON.stringify(editableCanvas))

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const data = await parseApiResponse(response, '分析失败')

      sessionStorage.setItem('analysisResult', JSON.stringify(data))
      router.push('/explore')
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析服务异常')
      setStep('direction')
    }
  }

  const handleReset = () => {
    setStep('upload')
    setImage(null)
    setImagePreview('')
    setAddress('')
    setError('')
  }

  // ==== 步骤1：上传 ====
  if (step === 'upload') {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold ink-text mb-2">
              🏠 阳宅风水评估
            </h1>
            <p className="text-lg ink-light">
              上传户型图，AI 结合九宫飞星与地理信息，为您解读居家风水
            </p>
            <div className="flex justify-center gap-2 mt-3 text-sm ink-light">
              <span>玄空风水</span><span className="text-accent">·</span>
              <span>九宫飞星</span><span className="text-accent">·</span>
              <span>一键排盘</span>
            </div>
          </div>

          <div className="paper-card rounded-xl p-6 mb-6">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                imagePreview ? 'border-accent bg-paper' : 'border-border hover:border-accent'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }} />
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="户型图预览" className="max-h-64 mx-auto rounded-lg" />
                  <button onClick={(e) => { e.stopPropagation(); setImage(null); setImagePreview('') }}
                    className="absolute top-2 right-2 bg-accent-red text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">×</button>
                  <p className="mt-3 text-sm ink-light">点击更换图片</p>
                </div>
              ) : (
                <div>
                  <div className="text-5xl mb-3">📤</div>
                  <p className="text-lg ink-text font-medium mb-1">点击或拖拽上传户型图</p>
                  <p className="text-sm ink-light">支持 JPG、PNG 格式，大小不超过 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="paper-card rounded-xl p-6 mb-6">
            <label className="block text-sm font-medium ink-text mb-3">小区信息</label>
            <AddressSelector onAddressChange={setAddress} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}

          <button
            onClick={handleToFloorplanConfirm}
            disabled={!image || !address.trim()}
            className="btn-primary w-full text-lg disabled:opacity-50"
          >
            下一步：确认户型图 →
          </button>

          <p className="text-center text-xs ink-light mt-4">AI 风水评估仅供娱乐参考，不构成专业建议</p>
        </div>
      </main>
    )
  }

  // ==== 步骤2：户型图确认 ====
  if (step === 'floorplan-confirm') {
    if (!editableCanvas) {
      return (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
            <p className="ink-light">正在生成户型图...</p>
          </div>
        </main>
      )
    }

    return (
      <main className="flex-1 flex items-start justify-center p-4 overflow-auto">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold ink-text mb-2">📐 确认户型图</h1>
            <p className="text-sm ink-light">
              请核对 AI 识别的房间布局是否正确。您可以拖动调整房间位置和大小
            </p>
          </div>

          <div className="flex justify-center mb-4">
            <InteractiveFloorplan
              canvas={editableCanvas}
              onCanvasChange={setEditableCanvas}
              onConfirm={handleFloorplanConfirm}
              originalImageBase64={imageBase64}
            />
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setStep('upload')}
              className="px-6 py-3 border border-border rounded-lg hover:bg-paper transition-colors ink-light"
            >
              ← 返回上传
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ==== 步骤3：方向确认 ====
  if (step === 'direction') {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold ink-text mb-2">🧭 确认户型朝向</h1>
            <p className="text-sm ink-light">
              请确认户型图的真实朝向。朝向决定九宫飞星排盘，直接影响风水分析的准确性。
            </p>
          </div>

          <div className="paper-card rounded-xl p-6 mb-6">
            <h2 className="text-sm font-medium ink-text mb-3">
              📐 请在下方选择户型图的 <span className="text-accent font-bold">向方</span>
            </h2>
            <p className="text-xs ink-light mb-4">
              向方 = 房屋采光面最强的方向，通常是阳台或主窗的朝向
            </p>

            <div className="relative w-full aspect-[2/1] bg-paper-dark rounded-xl mb-6 flex items-center justify-center overflow-hidden">
              {/* 外层容器固定 */}
              <div className="relative w-[280px] h-[280px]">
                {/* 固定文字标注层 */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-bold text-accent-red z-10">南(午)</div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-bold text-ink z-10">北(子)</div>
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold text-ink z-10">东(卯)</div>
                <div className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-ink z-10">西(酉)</div>
                <div className="absolute top-6 right-6 text-[10px] ink-light z-10">东南</div>
                <div className="absolute top-6 left-6 text-[10px] ink-light z-10">西南</div>
                <div className="absolute bottom-6 right-6 text-[10px] ink-light z-10">东北</div>
                <div className="absolute bottom-6 left-6 text-[10px] ink-light z-10">西北</div>
                {/* 旋转的圆盘层 */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-border bg-white/50 transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${-((MOUNTAINS.find(m => m.value === facingDirection) ?? { degree: 0 }).degree)}deg)` }}
                >
                  {/* 十字线 */}
                  <div className="absolute inset-0">
                    <div className="absolute top-0 left-1/2 w-px h-full bg-accent/20 origin-bottom" style={{ transform: 'translateX(-50%) rotate(0deg)' }} />
                    <div className="absolute top-1/2 left-0 h-px w-full bg-accent/20 origin-right" style={{ transform: 'translateY(-50%) rotate(0deg)' }} />
                  </div>
                  {/* 中心 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-1">🧭</div>
                      <div className="text-sm font-bold accent-text">{facingDirection}</div>
                      <div className="text-[10px] ink-light">向方</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium ink-text mb-2">
                选择 <span className="text-accent font-bold">向方</span>（屋子采光面朝向哪个方向？）
              </label>
              <select
                value={facingDirection}
                onChange={(e) => setFacingDirection(e.target.value as TwentyFourMountain)}
                className="w-full px-4 py-3 bg-paper text-ink border border-border rounded-lg focus:outline-none focus:border-accent transition-colors"
              >
                {MOUNTAINS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs ink-light mt-2">
                💡 如果不确定精确度数，选最接近的八个正方位之一即可（子/午/卯/酉/艮/坤/乾/巽）
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}

          <div className="flex gap-4">
            <button onClick={handleReset} className="flex-1 px-4 py-3 border border-border rounded-lg hover:bg-paper transition-colors ink-light text-sm">
              ← 返回重选
            </button>
            <button onClick={handleStartAnalyze} className="flex-[2] btn-primary text-lg">
              🔮 确认并开始评估
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ==== 步骤3：分析中 ====
  if (step === 'analyzing') {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="animate-spin h-10 w-10 border-3 border-accent border-t-transparent rounded-full mx-auto mb-6" />
          <h2 className="text-xl font-bold ink-text mb-2">正在分析中</h2>
          <p className="text-sm ink-light mb-4">AI 正在识别户型 · 排布九宫飞星 · 生成风水报告</p>
          <div className="space-y-2">
            <ProgressStep label="识别户型结构" status="active" />
            <ProgressStep label="排布玄空飞星" status="pending" />
            <ProgressStep label="分析周边环境" status="pending" />
            <ProgressStep label="生成风水报告" status="pending" />
          </div>
        </div>
      </main>
    )
  }
}

function ProgressStep({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
        status === 'done' ? 'bg-accent-green text-white' :
        status === 'active' ? 'bg-accent text-white animate-pulse-gold' :
        'bg-border text-ink-light'
      }`}>
        {status === 'done' ? '✓' : status === 'active' ? '◉' : '○'}
      </div>
      <span className={status === 'active' ? 'ink-text font-medium' : 'ink-light'}>{label}</span>
    </div>
  )
}
