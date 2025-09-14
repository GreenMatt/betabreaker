import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: sessionData, error } = await supabase.auth.getSession()
  if (error) return NextResponse.json({ error: error.message }, { status: 200 })
  return NextResponse.json({ session: sessionData.session })
}

