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
  const [dbPhoto, setDbPhoto] = useState<string | null>(null)

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

  // Load profile photo from users table to avoid stale or missing provider avatar
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!user?.id) { setDbPhoto(null); return }
        const { data } = await supabase.from('users').select('profile_photo').eq('id', user.id).maybeSingle()
        if (!cancelled) setDbPhoto((data as any)?.profile_photo || null)
      } catch {
        if (!cancelled) setDbPhoto(null)
      }
    })()
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
          className="relative group p-1 rounded-full transition-all duration-200 hover:ring-2 hover:ring-white/20 hover:ring-offset-2 hover:ring-offset-transparent"
          onClick={() => setMenuOpen(v => !v)}
        >
          {dbPhoto || user.user_metadata?.avatar_url ? (
            <img 
              src={dbPhoto || user.user_metadata.avatar_url} 
              alt="Profile" 
              onError={(e: any) => { try { e.currentTarget.src = '/icons/betabreaker_header.png' } catch {} }}
              className="w-8 h-8 rounded-full object-cover border-2 border-white/10 group-hover:border-white/30 transition-colors"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-white/10 group-hover:border-white/30 transition-colors">
              <span className="text-white text-sm font-semibold">
                {user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U'}
              </span>
            </div>
          )}
          
          {/* Active indicator */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black transition-all duration-200 ${
            menuOpen ? 'bg-green-400 scale-110' : 'bg-green-500 scale-100'
          }`} />
        </button>
        
        {menuOpen && (
          <div className="absolute right-0 mt-3 w-64 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* User info header */}
            <div className="px-4 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-600/10">
              <div className="flex items-center gap-3">
                {dbPhoto || user.user_metadata?.avatar_url ? (
                  <img 
                    src={dbPhoto || user.user_metadata.avatar_url} 
                    alt="Profile" 
                    onError={(e: any) => { try { e.currentTarget.src = '/icons/betabreaker_header.png' } catch {} }}
                    className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-white/20">
                    <span className="text-white font-semibold">
                      {user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.user_metadata?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/profile/me"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-all duration-150"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </Link>
              
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-all duration-150"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              
              <hr className="border-white/10 my-2" />
              
              <button
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150"
                onClick={() => { setMenuOpen(false); signOut() }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
