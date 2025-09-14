// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Build a resilient Supabase client with a 401 retry on token refresh.
// If the access token expires while the tab is backgrounded, the first
// request after returning may hit 401. We attempt a refresh once and retry.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

let clientRef: SupabaseClient | null = null

const debugOn = () => {
  try {
    // Enable by running: localStorage.setItem('BB_DEBUG','1')
    return (typeof window !== 'undefined' && localStorage.getItem('BB_DEBUG') === '1') || process.env.NODE_ENV === 'development'
  } catch { return process.env.NODE_ENV === 'development' }
}

const resilientFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const toUrl = () => {
    try { return typeof input === 'string' ? input : (input as Request).url || (input as URL).toString() } catch { return '' }
  }
  const reqUrl = toUrl()
  const supabaseOrigin = (() => { try { return new URL(SUPABASE_URL).origin } catch { return '' } })()

  // First attempt
  try {
    if (debugOn() && reqUrl.startsWith(supabaseOrigin)) {
      console.log('[SB fetch] →', { url: reqUrl, method: (init as any)?.method || (input as any)?.method || 'GET' })
    }
    const res = await fetch(input as any, init)

    // If unauthorized to Supabase, try a one-time refresh and retry
    if ((res.status === 401 || res.status === 403) && reqUrl.startsWith(supabaseOrigin)) {
      if (debugOn()) console.warn('[SB fetch] 401/403 → refreshing session and retry', { url: reqUrl, status: res.status })
      try { await clientRef?.auth.refreshSession() } catch {}
      return await fetch(input as any, init)
    }
    if (debugOn() && reqUrl.startsWith(supabaseOrigin)) {
      console.log('[SB fetch] ←', { url: reqUrl, status: res.status })
    }
    return res
  } catch (e: any) {
    // Handle transient network changes for Supabase calls: wait briefly and retry once
    const isNetworkErr = e && (e.name === 'TypeError' || /Network|Failed to fetch|ERR_NETWORK/i.test(String(e)))
    if (isNetworkErr && reqUrl.startsWith(supabaseOrigin)) {
      if (debugOn()) console.warn('[SB fetch] network error, retrying once', { url: reqUrl, error: String(e) })
      // Small backoff; if back online, retry
      await new Promise(r => setTimeout(r, 800))
      try {
        const res2 = await fetch(input as any, init)
        if ((res2.status === 401 || res2.status === 403)) {
          if (debugOn()) console.warn('[SB fetch] retry got 401/403, refreshing then retrying again', { url: reqUrl, status: res2.status })
          try { await clientRef?.auth.refreshSession() } catch {}
          return await fetch(input as any, init)
        }
        if (debugOn()) console.log('[SB fetch] ← (retry)', { url: reqUrl, status: res2.status })
        return res2
      } catch {
        // give up; rethrow original
        if (debugOn()) console.error('[SB fetch] retry failed', { url: reqUrl, error: String(e) })
        throw e
      }
    }
    throw e
  }
}

export const supabase = (() => {
  const client = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // handles OAuth redirect
      },
      global: {
        fetch: resilientFetch,
      },
      // db: { schema: 'public' }, // optional
    }
  )
  clientRef = client
  return client
})()
