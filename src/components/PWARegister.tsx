"use client"
import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    // Opt-in only: enable the SW when NEXT_PUBLIC_ENABLE_SW=1
    const enabled = process.env.NEXT_PUBLIC_ENABLE_SW === '1'
    if (!enabled) return
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      })
    }
  }, [])
  return null
}
