"use client"
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function VisibilityRefresher() {
  const router = useRouter()
  const lastTick = useRef(0)

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) return
      const now = Date.now()
      if (now - lastTick.current < 250) return
      lastTick.current = now
      try { router.refresh() } catch {}
    }
    const onFocus = () => onVis()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [router])
  return null
}



