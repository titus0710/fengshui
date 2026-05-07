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

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('模型返回格式无法解析为 JSON')
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`JSON 解析失败: ${content.substring(0, 200)}`)
  }
}
