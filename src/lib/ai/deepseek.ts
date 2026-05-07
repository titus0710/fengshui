const DEEPSEEK_MODEL = 'deepseek-chat'

async function createChatCompletion(params: {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  maxTokens: number
  temperature: number
  stream?: boolean
}): Promise<Response | { content: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY 环境变量')
  }

  const bodyStr = JSON.stringify({
    model: DEEPSEEK_MODEL,
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    stream: params.stream || false,
  })

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: new TextEncoder().encode(bodyStr),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`DeepSeek API 错误: ${(err as { error?: { message?: string } }).error?.message || res.statusText}`)
  }

  if (params.stream) {
    return res
  }

  const data = await res.json()
  return { content: data.choices[0]?.message?.content || '' }
}

const FENGSHUI_SYSTEM_PROMPT = `你是一位精通中国传统玄空风水学的风水大师，精通八卦、九宫飞星、八宅明镜等理论。
根据提供的户型结构数据、玄空飞星排盘和地理信息，请进行全面风水分析。

分析时请重点关注：
1. 玄空飞星九宫各宫的山星、向星、运星组合在户型各区域的表现
2. 当运旺星（当前九运：9为旺气、8为生气、1为进气）落在哪些房间
3. 失运退气之星（2、5为病符灾星，3、7为贼星是非）需要化解的位置
4. 形煞（路冲、反弓水、天斩煞等）与飞星组合的叠加影响

你必须输出以下 JSON 格式（不要包含任何其他文字）：

{
  "points": [
    {
      "id": "point_01",
      "type": "caifang|xiongwei|taohua|wenchang|bingwei|shasource",
      "label": "点位名称（如 正财位·九紫旺星）",
      "x": 0.35, "y": 0.42,
      "room": "所属房间名称",
      "layer": "feixing|bagua|xingsha|caifang|jiegou",
      "analysis": "该点位的详细风水解读（50-100字，必须结合飞星组合说明）",
      "suggestion": "化解或利用建议（30-80字）",
      "element": "五行属性（金木水火土）",
      "severity": "good|neutral|warning|danger"
    }
  ],
  "report_markdown": "完整的玄空风水评估报告（Markdown，包含：一、飞星盘总览，二、九宫逐宫分析，三、形煞与飞星叠加，四、逐区域详细分析，五、财位与旺星催旺法，六、凶星化解方案）",
  "overview": {
    "bagua": "结合飞星的八卦方位说明",
    "overall_score": 75,
    "summary": "整体评估总结（1-2句话）"
  }
}

分析要求：
1. 每个点位必须结合飞星组合（如山星8向星9 = 八九生旺）来解读
2. 旺星位（9紫8白1白）应标注为 caifang 并发掘催旺方法
3. 凶星位（2黑5黄）应标注为 xiongwei/bingwei 并给化解方案
4. 标注至少 8-15 个关键风水点位
5. 每个点位 layer 字段必须填写（feixing=飞星点位, bagua=八卦, xingsha=形煞, caifang=财位, jiegou=结构）
6. 坐标 (x,y) 相对于户型图比例（0-1）
7. report_markdown 需 >1000 字，风格专业典雅`

export async function analyzeFengshui(input: {
  rooms: string
  direction: string
  overallShape: string
  geoInfo: string
  flyingStarChart?: string
}): Promise<{
  points: {
    id: string; type: string; label: string; x: number; y: number
    room?: string; analysis: string; suggestion: string
    element?: string; severity: string; layer?: string
  }[]
  reportMarkdown: string
  overview: { bagua: string; overallScore?: number; summary: string }
}> {
  const feixingSection = input.flyingStarChart
    ? `

玄空飞星排盘：
${input.flyingStarChart}

请结合以上飞星盘数据，分析各宫位星组组合对户型各区域的具体影响。`
    : ''

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: FENGSHUI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请分析以下户型的风水：

户型信息：
- 朝向：${input.direction}
- 整体形状：${input.overallShape}
- 房间结构：${input.rooms}
${feixingSection}
地理环境信息：
${input.geoInfo}

请严格按照 JSON 格式输出完整分析结果。`,
      },
    ],
    maxTokens: 8192,
    temperature: 0.3,
  })

  const content = (result as { content: string }).content
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('风水分析返回格式无法解析')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      points: parsed.points || [],
      reportMarkdown: parsed.report_markdown || '',
      overview: parsed.overview || { bagua: '', summary: '' },
    }
  } catch {
    throw new Error(`风水分析 JSON 解析失败: ${content.substring(0, 200)}`)
  }
}

export async function chatReply(input: {
  messages: { role: 'user' | 'assistant'; content: string }[]
  chatContext: string
}): Promise<ReadableStream> {
  const apiResponse = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: `你是一位精通中国传统风水学的风水大师，正在通过线上平台为用户解答风水问题。
【重要规则】
1. 绝对不要向用户索要任何图片、户型图或额外信息
2. 所有的分析结论都已经包含在下面的"风水分析报告"中
3. 如果用户询问你不了解的信息，请基于已有报告进行专业推断，而不是要求用户提供更多信息
4. 如果用户问题超出风水和居家布局范围，请礼貌引导回到风水话题

以下是本次风水评估的完整报告（包含户型信息、九宫飞星排盘、地理环境分析、详细报告）：

${input.chatContext}

请基于以上报告内容，以专业风水大师的身份回答用户问题。回答风格应专业、优雅、有深度，善用风水术语。`,
      },
      ...input.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    maxTokens: 2048,
    temperature: 0.5,
    stream: true,
  })

  const res = apiResponse as Response
  if (!res.body) {
    throw new Error('DeepSeek API 未返回流式响应')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                controller.enqueue(encoder.encode(delta))
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
      controller.close()
    }
  })
}
