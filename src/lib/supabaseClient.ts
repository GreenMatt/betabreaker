// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Build a resilient Supabase client with a 401 retry on token refresh.
// If the access token expires while the tab is backgrounded, the first
// request after returning may hit 401. We attempt a refresh once and retry.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

let clientRef: SupabaseClient | null = null

const resilientFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await fetch(input as any, init)

  // Only consider retrying for requests that go to our Supabase project
  // and that fail with auth errors.
  if ((res.status === 401 || res.status === 403) && typeof SUPABASE_URL === 'string' && SUPABASE_URL) {
    try {
      const reqUrl = typeof input === 'string' ? input : (input as Request).url || (input as URL).toString()
      const supabaseOrigin = new URL(SUPABASE_URL).origin
      if (reqUrl.startsWith(supabaseOrigin)) {
        // Attempt a one-time refresh and retry
        await clientRef?.auth.refreshSession().catch(() => {})
        return await fetch(input as any, init)
      }
    } catch {
      // fall through and return original response
    }
  }

  return res
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
