import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export function getServerSupabase() {
  const cookieStore = cookies()
  return createServerComponentClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        get(name: string) {
          const v = cookieStore.get(name)?.value
          return v
        },
        set(name: string, value: string, options: any) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: any) {
          try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }) } catch {}
        }
      }
    }
  )
}
