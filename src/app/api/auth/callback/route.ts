import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    try { await supabase.auth.exchangeCodeForSession(code) } catch {}
  }
  // Safely derive redirect target. Allow only same-origin relative paths.
  let redirectTo = url.searchParams.get('next') || '/'
  try {
    const dest = new URL(redirectTo, url.origin)
    const sameOrigin = dest.origin === url.origin
    const looksProtocolRelative = /^\/\//.test(redirectTo)
    if (!sameOrigin || looksProtocolRelative) {
      redirectTo = '/'
    } else {
      // Normalize to path + search + hash to avoid leaking origin manipulation
      redirectTo = dest.pathname + dest.search + dest.hash
    }
  } catch {
    redirectTo = '/'
  }
  return NextResponse.redirect(new URL(redirectTo, url.origin))
}

export const dynamic = 'force-dynamic'
