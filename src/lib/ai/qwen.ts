const QWEN_MODEL = 'qwen3-vl-plus'

async function createChatCompletion(params: {
  messages: { role: 'system' | 'user'; content: unknown }[]
  maxTokens: number
  temperature: number
}): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY 环境变量')
  }

  const bodyStr = JSON.stringify({
    model: QWEN_MODEL,
    messages: params.messages as Record<string, unknown>[],
    max_tokens: params.maxTokens,
    temperature: params.temperature,
  })

  const res = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: new TextEncoder().encode(bodyStr),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Qwen API 错误: ${(err as { error?: { message?: string } }).error?.message || res.statusText}`
    )
  }

  const data = await res.json()
  return data.choices[0]?.message?.content || ''
}

const FLOORPLAN_SYSTEM_PROMPT = `你是一位专业的建筑图纸分析专家。请仔细分析这张户型图，输出以下严格的 JSON 结构：

{"direction":"坐北朝南","overall_shape":"方正","rooms":[{"name":"客厅","type":"living","bounds":{"x":0.1,"y":0.2,"width":0.3,"height":0.4},"notes":""}]}

重要规则：
1. bounds 必须是 {"x":数字,"y":数字,"width":数字,"height":数字} 四个属性缺一不可
2. x,y,width,height 都是相对于图片尺寸的比例（0-1之间）
3. 只输出 JSON，不要任何解释文字

请分析户型图：`

function fixMalformedJson(str: string): string {
  str = str.replace(/"y":\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*([,}])/g, (_, y, w, h, punct) => {
    return `"y": ${y}, "width": ${w}, "height": ${h}${punct}`
  })
  str = str.replace(/"x":\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*"width/g, (_, x, y) => {
    return `"x": ${x}, "y": ${y}, "width`
  })
  str = str.replace(/"x":\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*}/g, (_, x, y) => {
    return `"x": ${x}, "y": ${y}}`
  })
  str = str.replace(/"width":\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*"height/g, (_, w, h) => {
    return `"width": ${w}, "height": ${h}, "height`
  })
  str = str.replace(/"width":\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*}/g, (_, w, h) => {
    return `"width": ${w}, "height": ${h}}`
  })
  str = str.replace(/"height":\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\}/g, (_, h1, h2) => {
    return `"height": ${h1}, "___extra": ${h2}}`
  })
  return str
}

function extractBoundsNumbers(boundsStr: string): { x: number; y: number; width: number; height: number } {
  const nums: number[] = []
  const matches = boundsStr.matchAll(/([0-9]+\.?[0-9]*)/g)
  for (const m of matches) {
    const n = parseFloat(m[1])
    if (!isNaN(n) && n >= 0 && n <= 10) nums.push(n)
  }
  if (nums.length >= 4) {
    return { x: nums[0], y: nums[1], width: nums[2], height: nums[3] }
  } else if (nums.length >= 2) {
    return { x: 0, y: 0, width: nums[0], height: nums[1] }
  }
  return { x: 0, y: 0, width: 0.1, height: 0.1 }
}

function parseRoomsWithBoundsFix(content: string): {
  rooms: { name: string; type: string; bounds: { x: number; y: number; width: number; height: number }; notes: string }[]
  direction: string
  overallShape: string
} {
  let result = content
  result = fixMalformedJson(result)

  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`模型返回格式无法解析为 JSON，原始内容：${content.substring(0, 300)}`)
  }

  let jsonStr = jsonMatch[0]
  const lastBrace = jsonStr.lastIndexOf('}')
  if (lastBrace !== jsonStr.length - 1) {
    jsonStr = jsonStr.substring(0, lastBrace + 1)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    const preview = jsonStr.substring(0, 500)
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '未知错误'}，内容预览：${preview}`)
  }

  if (parsed.overall_shape !== undefined && parsed.overallShape === undefined) {
    parsed.overallShape = parsed.overall_shape as string
  }

  if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
    throw new Error('返回数据缺少 rooms 数组')
  }

  const rooms = parsed.rooms.map((room: Record<string, unknown>, index: number) => {
    const name = String(room.name || `房间${index + 1}`)
    const type = String(room.type || 'other')
    const notes = String(room.notes || '')

    let bounds = { x: 0, y: 0, width: 0.1, height: 0.1 }
    if (room.bounds && typeof room.bounds === 'object') {
      try {
        const boundsStr = JSON.stringify(room.bounds)
        bounds = extractBoundsNumbers(boundsStr)
      } catch {
        bounds = { x: 0, y: 0, width: 0.1, height: 0.1 }
      }
    }

    return { name, type, notes, bounds }
  })

  return {
    rooms,
    direction: String(parsed.direction || '未知'),
    overallShape: String(parsed.overallShape || parsed.overall_shape || '方正'),
  }
}

export async function recognizeFloorplan(input: {
  imageBase64: string
}): Promise<{
  rooms: { name: string; type: string; bounds: { x: number; y: number; width: number; height: number }; notes: string }[]
  direction: string
  overallShape: string
}> {
  const content = await createChatCompletion({
    messages: [
      { role: 'system', content: FLOORPLAN_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请分析这张户型图，严格按照 JSON 格式输出。' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` } },
        ],
      },
    ],
    maxTokens: 4096,
    temperature: 0.1,
  })

  return parseRoomsWithBoundsFix(content)
}
