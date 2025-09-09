"use client"
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/authContext'
import { supabase } from '@/lib/supabaseClient'

export default function UserNav() {
  const { user, signOut } = useAuth()
  const [unread, setUnread] = useState<number>(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!user) {
    return (
      <div className="ml-auto flex items-center gap-2">
        <Link href="/login" className="btn-primary">Login</Link>
      </div>
    )
  }

  return (
    <div className="ml-auto flex items-center gap-3">
      <Link href="/notifications" aria-label="Notifications" className="relative p-2 rounded hover:bg-white/5" onClick={() => setUnread(0)}>
        {/* Bell icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-base-subtext">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.311 6.022c1.733.64 3.56 1.085 5.455 1.31m5.713 0a24.255 24.255 0 01-5.713 0m5.713 0a3 3 0 11-5.713 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] leading-none text-white text-center shadow ring-1 ring-white/80">
            {unread}
          </span>
        )}
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          aria-label="Profile menu"
          className="p-2 rounded hover:bg-white/5"
          onClick={() => setMenuOpen(v => !v)}
        >
          {/* User icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-base-subtext">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6A3.75 3.75 0 1112 2.25 3.75 3.75 0 0115.75 6zM4.5 20.25a7.5 7.5 0 0115 0V21H4.5v-.75z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-40 rounded-md border border-white/10 bg-black/70 backdrop-blur-sm shadow-lg">
            <Link
              href="/profile/me"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              View Profile
            </Link>
            <button
              className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
              onClick={() => { setMenuOpen(false); signOut() }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

