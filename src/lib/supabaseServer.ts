import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

// Use auth-helpers' native cookies adapter. Do not pass URL/key here;
// it reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
export function getServerSupabase() {
  return createServerComponentClient({ cookies })
}
