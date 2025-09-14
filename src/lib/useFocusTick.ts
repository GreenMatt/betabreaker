"use client"
import { useEffect, useRef, useState } from 'react'

export function useFocusTick(debounceMs = 250) {
  const [tick, setTick] = useState(0)
  const last = useRef(0)
  useEffect(() => {
    const bump = () => {
      const now = Date.now()
      if (now - last.current < debounceMs) return
      last.current = now
      setTick(t => t + 1)
    }
    const onVis = () => { if (!document.hidden) bump() }
    const onFocus = () => bump()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [debounceMs])
  return tick
}

