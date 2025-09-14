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
  const redirectTo = url.searchParams.get('next') || '/'
  return NextResponse.redirect(new URL(redirectTo, req.url))
}

export const dynamic = 'force-dynamic'

