import { v4 as uuidv4 } from 'uuid'
import { analyzeFengshui } from '@/lib/ai/deepseek'
import { analyzeGeo, geoToFengshuiText } from '@/lib/geo/amap'
import { calculateFlyingStarChart, flyingStarToText } from '@/lib/fengshui/xuankong'
import { canvasToPalaceMappings } from '@/lib/floorplan/editable'
import type { EditableRoom, FloorplanCanvas } from '@/lib/floorplan/editable'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const address = formData.get('address') as string | null
    const facing = (formData.get('facing') as string) || '午'
    const period = parseInt((formData.get('period') as string) || '9')
    const canvasStr = formData.get('canvas') as string | null

    if (!imageFile) {
      return Response.json({ error: '请上传户型图' }, { status: 400 })
    }
    if (!address) {
      return Response.json({ error: '请选择小区地址' }, { status: 400 })
    }

    const imageBytes = await imageFile.arrayBuffer()
    const imageBase64 = Buffer.from(imageBytes).toString('base64')

    if (!canvasStr) {
      return Response.json({ error: '户型图未确认' }, { status: 400 })
    }

    const canvas: FloorplanCanvas = JSON.parse(canvasStr)

    const flyingStar = calculateFlyingStarChart(period, facing)
    const feixingText = flyingStarToText(flyingStar)

    const geoData = await analyzeGeo(address)
    const geoFengshuiText = geoToFengshuiText(geoData)

    const mappings = canvasToPalaceMappings(canvas, flyingStar)

    const roomsSummary = mappings
      .map(m => {
        return `- ${m.roomName}：位于${m.palaceDirection}(${m.palaceTrigram}宫)，运星${m.periodStar}，山星${m.mountainStar}，向星${m.waterStar}，解读：${m.interpretation}`
      })
      .join('\n')

    const fengshuiData = await analyzeFengshui({
      rooms: roomsSummary,
      direction: `${flyingStar.sitting}山${flyingStar.facing}向`,
      overallShape: '用户确认户型图',
      geoInfo: geoFengshuiText,
      flyingStarChart: feixingText,
    })

    const computedPoints = mappings.map((m, i) => {
      const isGoodPalace = [9, 8, 1].includes(m.periodStar)
      const isBadPalace = [2, 5].includes(m.periodStar) || [2, 5].includes(m.mountainStar)

      const type = isGoodPalace ? 'caifang' : isBadPalace ? 'xiongwei' : 'wenchang'
      const severity = isBadPalace ? 'danger' : isGoodPalace ? 'good' : 'neutral'

      const existing = fengshuiData.points.find(
        ep => ep.room === m.roomName && ep.type === type
      )

      return {
        id: `point_${String(i + 1).padStart(2, '0')}`,
        type,
        label: existing?.label || `${isGoodPalace ? '财位' : isBadPalace ? '凶位' : '文昌位'}·${m.roomName}`,
        x: m.centerX,
        y: m.centerY,
        room: m.roomName,
        analysis: existing?.analysis || `${m.palaceTrigram}宫位，运星${m.periodStar}，山星${m.mountainStar}，向星${m.waterStar}。${m.interpretation}`,
        suggestion: existing?.suggestion || m.interpretation,
        element: '',
        severity: existing?.severity || severity,
        layer: 'caifang',
      }
    })

    const sessionId = uuidv4()

    const result = {
      floorplan: {
        imageBase64,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        rooms: canvas.rooms.map((r: EditableRoom) => {
          const xs = r.points.map(p => p.x)
          const ys = r.points.map(p => p.y)
          const minX = Math.min(...xs)
          const minY = Math.min(...ys)
          const maxX = Math.max(...xs)
          const maxY = Math.max(...ys)
          return {
            name: r.name,
            type: r.type,
            bounds: {
              x: minX / canvas.width,
              y: minY / canvas.height,
              width: (maxX - minX) / canvas.width,
              height: (maxY - minY) / canvas.height,
            },
            points: r.points.map(p => ({ x: p.x / canvas.width, y: p.y / canvas.height })),
            notes: '',
          }
        }),
        direction: `${flyingStar.sitting}山${flyingStar.facing}向`,
        overallShape: '用户确认户型图',
        roomPalaceMappings: mappings,
      },
      geo: {
        address: geoData.address,
        lng: geoData.lng,
        lat: geoData.lat,
        satelliteUrl: geoData.satelliteUrl,
        terrain: geoData.terrain,
        waterFeatures: geoData.waterFeatures,
        roadFeatures: geoData.roadFeatures,
        buildingFeatures: geoData.buildingFeatures,
        specialFeatures: geoData.specialFeatures,
      },
      fengshui: {
        points: computedPoints,
        reportMarkdown: fengshuiData.reportMarkdown,
        overview: fengshuiData.overview,
        flyingStar,
      },
      chatContext: `户型信息：
朝向：${flyingStar.sitting}山${flyingStar.facing}向（${period}运）
形状：用户确认户型图
房间及九宫映射：
${roomsSummary}

玄空飞星排盘：
${feixingText}

地理风水环境：
${geoFengshuiText}

风水分析概述：
${fengshuiData.overview.summary}

详细报告：
${fengshuiData.reportMarkdown}`,
      sessionId,
    }

    return Response.json(result)
  } catch (error) {
    console.error('分析失败:', error)
    const message = error instanceof Error ? error.message : '分析服务异常，请稍后重试'
    return Response.json({ error: message }, { status: 500 })
  }
}
