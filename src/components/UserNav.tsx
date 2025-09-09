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
    <div className="ml-auto flex items-center gap-2">
      <Link href="/notifications" className="relative text-sm text-base-subtext">
        Notifications
        {unread > 0 && (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-black">
            {unread}
          </span>
        )}
      </Link>
      <Link href="/profile/me" className="text-sm text-base-subtext">Profile</Link>
      <button className="btn-primary" onClick={signOut}>Sign out</button>
    </div>
  )
}

