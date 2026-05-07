import { chatReply } from '@/lib/ai/deepseek'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messages, chatContext } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      chatContext: string
    }

    if (!messages?.length || !chatContext) {
      return Response.json({ error: '缺少消息或上下文' }, { status: 400 })
    }

    const stream = await chatReply({ messages, chatContext })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat 失败:', error)
    const message = error instanceof Error ? error.message : '问答服务异常'
    return Response.json({ error: message }, { status: 500 })
  }
}
