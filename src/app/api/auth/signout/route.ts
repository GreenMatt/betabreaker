import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies })
  try {
    await supabase.auth.signOut()
  } catch {}
  return NextResponse.json({ ok: true })
}

