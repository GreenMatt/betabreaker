"use client"
import { supabase } from '@/lib/supabaseClient'

type LogParams = {
  level?: 'error' | 'warn' | 'info'
  message: string
  stack?: string
  extra?: Record<string, any>
}

export async function logClientError(params: LogParams) {
  try {
    const { message, stack, extra, level } = params
    const url = typeof window !== 'undefined' ? window.location.href : undefined
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    await supabase.from('client_logs').insert({
      level: level || 'error',
      message: message?.toString().slice(0, 8000),
      stack: stack?.toString().slice(0, 8000),
      url,
      ua,
      extra: extra || {}
    })
  } catch {
    // ignore log failures
  }
}

