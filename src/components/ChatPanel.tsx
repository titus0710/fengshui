'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalysisResult, ChatMessage } from '@/lib/types'

export default function ChatPanel({
  result,
  onMessagesChange,
}: {
  result: AnalysisResult
  onMessagesChange: (messages: ChatMessage[]) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    onMessagesChange(messages)
  }, [messages, onMessagesChange])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
          chatContext: result.chatContext,
        }),
      })

      if (!response.ok) {
        throw new Error('问答请求失败')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: Date.now() }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        assistantContent += chunk
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: assistantContent,
          }
          return updated
        })
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，暂时无法回答您的问题，请稍后重试。',
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="paper-card rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 260px)' }}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium ink-text">💬 AI 风水问答</h3>
        <p className="text-xs ink-light mt-0.5">基于当前分析结果追问风水问题</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 fengshui-scrollbar" style={{ minHeight: '150px', maxHeight: '300px' }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm ink-light">想了解更多风水细节？</p>
            <p className="text-xs ink-light mt-1">试试问：主卧床应该朝哪摆？财位能放鱼缸吗？</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-paper text-ink border border-border'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bg-paper border border-border rounded-xl px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse-gold" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse-gold" style={{ animationDelay: '200ms' }} />
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse-gold" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的风水问题..."
            className="flex-1 px-3 py-2 bg-paper text-ink border border-border rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
