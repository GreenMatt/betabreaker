"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/authContext'
import { supabase } from '@/lib/supabaseClient'

export default function UserNav() {
  const { user, signOut } = useAuth()
  const [unread, setUnread] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { setUnread(0); return }
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)
      if (!cancelled) setUnread(count || 0)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  if (!user) {
    return (
      <div className="ml-auto flex items-center gap-2">
        <Link href="/login" className="btn-primary">Login</Link>
      </div>
    )
  }

  return (
    <div className="ml-auto flex items-center gap-3">
      <Link href="/notifications" aria-label="Notifications" className="relative p-2 rounded hover:bg-white/5">
        {/* Bell icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-base-subtext">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.311 6.022c1.733.64 3.56 1.085 5.455 1.31m5.713 0a24.255 24.255 0 01-5.713 0m5.713 0a3 3 0 11-5.713 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] px-1.5 py-0.5 rounded-full bg-primary text-[10px] leading-none text-black text-center">
            {unread}
          </span>
        )}
      </Link>

      <Link href="/profile/me" aria-label="Profile" className="p-2 rounded hover:bg-white/5">
        {/* User icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-base-subtext">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6A3.75 3.75 0 1112 2.25 3.75 3.75 0 0115.75 6zM4.5 20.25a7.5 7.5 0 0115 0V21H4.5v-.75z" />
        </svg>
      </Link>

      <button className="btn-primary" onClick={signOut}>Sign out</button>
    </div>
  )
}

