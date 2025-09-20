import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: userData, error } = await supabase.auth.getUser()
  if (error) return NextResponse.json({ error: error.message }, { status: 200 })

  // Create a session-like object to maintain compatibility
  const session = userData.user ? {
    user: userData.user,
    access_token: null, // getUser doesn't return tokens for security
    refresh_token: null,
    expires_at: null,
    expires_in: null,
    token_type: 'bearer'
  } : null

  return NextResponse.json({ session })
}

