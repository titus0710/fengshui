'use client'

import { useState, useEffect, useCallback } from 'react'

const DISMISS_KEY = 'donate_dismissed_at'
const COOLDOWN_MS = 5 * 60 * 1000

export default function DonateFloating() {
  const [visible, setVisible] = useState(false)

  const shouldShow = useCallback(() => {
    if (typeof window === 'undefined') return false
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (!dismissedAt) return true
    return Date.now() - parseInt(dismissedAt, 10) >= COOLDOWN_MS
  }, [])

  useEffect(() => {
    if (shouldShow()) {
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }

    const interval = setInterval(() => {
      if (shouldShow()) {
        setVisible(true)
        clearInterval(interval)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [shouldShow])

  const handleClose = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))

    setTimeout(() => {
      setVisible(true)
    }, COOLDOWN_MS)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative w-60 bg-white rounded-xl shadow-xl border border-border p-4">
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors shadow-sm"
          aria-label="关闭"
        >
          ✕
        </button>

        <p className="text-center text-sm font-bold text-accent mb-3">
          卦不走空，随缘打赏！
        </p>

        <div className="flex justify-center">
          <img
            src="/qrcode.jpg"
            alt="收款二维码"
            className="w-44 h-44 object-contain rounded-lg border border-border"
          />
        </div>
      </div>
    </div>
  )
}
