"use client"
import React from 'react'
import { logClientError } from '@/lib/clientLog'

type State = { hasError: boolean, errMsg?: string }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, errMsg: error?.message || 'Unexpected error' }
  }

  async componentDidCatch(error: any, info: any) {
    await logClientError({ message: error?.message || 'ErrorBoundary', stack: error?.stack, extra: { info } })
  }

  private clearSupabaseLocal() {
    try {
      if (typeof localStorage === 'undefined') return
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        const lk = k.toLowerCase()
        if (lk.startsWith('sb-') || lk.includes('supabase')) keys.push(k)
      }
      keys.forEach(k => { try { localStorage.removeItem(k) } catch {} })
    } catch {}
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="max-w-md text-center space-y-3">
          <div className="text-lg font-semibold">Something went wrong</div>
          <div className="text-sm text-base-subtext">We’ve logged the issue so we can investigate.</div>
          <div className="flex items-center justify-center gap-2">
            <button className="btn-primary" onClick={() => { this.clearSupabaseLocal(); window.location.assign('/') }}>Home</button>
            <button className="btn-secondary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    )
  }
}

