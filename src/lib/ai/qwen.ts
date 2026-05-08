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

const FLOORPLAN_SYSTEM_PROMPT = `你是一位专业的建筑图纸分析专家。请仔细分析这张户型图，输出以下 JSON 结构（不要包含任何其他文字）：

{
  "direction": "推断的朝向（如 坐北朝南，如果无法判断请写 未知）",
  "overall_shape": "描述户型整体形状（如 方正、L型、缺角等）",
  "rooms": [
    {
      "name": "房间名称",
      "type": "living|bedroom|kitchen|bathroom|balcony|corridor|study|other",
      "bounds": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4 },
      "notes": "图中标注的文字，如果有的话"
    }
  ]
}

注意：
1. bounds 的 x, y, width, height 是相对于图片尺寸的比例（0-1），以图片左上角为原点
2. 请识别所有可见房间，包括但不限于客厅、卧室、厨房、卫生间、阳台、走廊、书房等
3. 如果图中有指北针或方向标注，请据此判断朝向
4. 只输出 JSON，不要包含任何解释文字`

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

  let jsonStr = content.trim()
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`模型返回格式无法解析为 JSON，原始内容：${jsonStr.substring(0, 300)}`)
  }

  jsonStr = jsonMatch[0]
  const lastBrace = jsonStr.lastIndexOf('}')
  if (lastBrace !== jsonStr.length - 1) {
    jsonStr = jsonStr.substring(0, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed.overall_shape !== undefined && parsed.overallShape === undefined) {
      parsed.overallShape = parsed.overall_shape
      delete parsed.overall_shape
    }
    if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
      throw new Error('返回数据缺少 rooms 数组')
    }
    parsed.rooms = parsed.rooms.map((room: Record<string, unknown>, index: number) => {
      const fixed: Record<string, unknown> = {
        name: String(room.name || `房间${index + 1}`),
        type: String(room.type || 'other'),
        notes: String(room.notes || ''),
      }
      const b = room.bounds
      if (b && typeof b === 'object') {
        const bObj = b as Record<string, unknown>
        if (typeof bObj.x === 'number') fixed.x = bObj.x
        if (typeof bObj.y === 'number') fixed.y = bObj.y
        if (typeof bObj.width === 'number') fixed.width = bObj.width
        if (typeof bObj.height === 'number') fixed.height = bObj.height
        if (fixed.x === undefined && !isNaN(Number(bObj.x))) fixed.x = Number(bObj.x)
        if (fixed.y === undefined && !isNaN(Number(bObj.y))) fixed.y = Number(bObj.y)
        if (fixed.width === undefined && !isNaN(Number(bObj.width))) fixed.width = Number(bObj.width)
        if (fixed.height === undefined && !isNaN(Number(bObj.height))) fixed.height = Number(bObj.height)
        if (fixed.x === undefined && fixed.y === undefined && fixed.width === undefined && fixed.height === undefined) {
          const vals = Object.values(bObj).filter(v => typeof v === 'number')
          if (vals.length >= 4) {
            fixed.x = vals[0]; fixed.y = vals[1]; fixed.width = vals[2]; fixed.height = vals[3]
          } else if (vals.length >= 2) {
            fixed.width = vals[0] || 0.1; fixed.height = vals[1] || 0.1
          }
        }
      }
      fixed.bounds = {
        x: Number(fixed.x) || 0,
        y: Number(fixed.y) || 0,
        width: Number(fixed.width) || 0.1,
        height: Number(fixed.height) || 0.1,
      }
      return fixed
    })
    return parsed
  } catch (parseError) {
    const preview = jsonStr.substring(0, 500)
    throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}，内容预览：${preview}`)
  }
}
