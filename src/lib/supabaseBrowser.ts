"use client"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function getBrowserSupabase() {
  return createClientComponentClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  )
}

// Backwards-compatible default export used across the app
export const supabase = getBrowserSupabase()
