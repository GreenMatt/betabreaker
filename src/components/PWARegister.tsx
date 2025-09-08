"use client"
import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    const enabled = process.env.NEXT_PUBLIC_ENABLE_SW === '1' || process.env.NODE_ENV === 'production'
    if (!enabled) return
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      })
    }
  }, [])
  return null
}
