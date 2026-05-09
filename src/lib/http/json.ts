function previewBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 200)
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null

  const record = data as Record<string, unknown>
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message
  }

  if (record.error && typeof record.error === 'object') {
    const error = record.error as Record<string, unknown>
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }
  }

  return null
}

export async function readJsonResponse<T>(response: Response, source: string): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  const trimmed = raw.trim()

  let parsed: T | null = null
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed) as T
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const message = extractErrorMessage(parsed)
    const preview = previewBody(raw)
    throw new Error(
      `${source} 错误 (${response.status})：${message || preview || response.statusText || '未知错误'}`
    )
  }

  if (parsed !== null) {
    return parsed
  }

  throw new Error(
    `${source} 返回了非 JSON 响应，content-type=${contentType || 'unknown'}，内容预览：${previewBody(raw)}`
  )
}
