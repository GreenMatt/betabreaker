import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  // Minimal CSRF protection: require either a same-origin referrer or a custom header
  const url = new URL(req.url)
  const origin = req.headers.get('origin') || ''
  const referer = req.headers.get('referer') || ''
  const csrfHeader = req.headers.get('x-csrf')

  const sameOriginByOrigin = origin ? origin === url.origin : true
  let sameOriginByRef = true
  if (referer) {
    try { sameOriginByRef = new URL(referer).origin === url.origin } catch { sameOriginByRef = false }
  }
  const allowed = csrfHeader === '1' || (sameOriginByOrigin && sameOriginByRef)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'CSRF check failed' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  try {
    await supabase.auth.signOut()
  } catch {}
  return NextResponse.json({ ok: true })
}
