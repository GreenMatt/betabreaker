"use client"
import { useEffect, useState } from 'react'
import AuthButtons from '@/components/AuthButtons'
import { supabase } from '@/lib/supabaseClient'
export const runtime = 'edge'

export default function ProfilePage({ params }: { params: { id: string } }) {
  const id = params.id
  const [uid, setUid] = useState<string | null>(null)
  const [badges, setBadges] = useState<Array<{ id: string, name: string, icon: string | null, description?: string | null }>>([])

  useEffect(() => {
    ;(async () => {
      if (id === 'me') {
        const { data } = await supabase.auth.getUser()
        setUid(data.user?.id ?? null)
        if (data.user?.id) await loadBadges(data.user.id)
      } else {
        setUid(id)
        await loadBadges(id)
      }
    })()
  }, [id])

  async function loadBadges(userId: string) {
    const { data } = await supabase
      .from('user_badges')
      .select('badge:badges(id,name,icon,description)')
      .eq('user_id', userId)
    setBadges((data || []).map((r: any) => r.badge))
  }

  function resolveIconUrl(icon: string | null): string {
    if (!icon) return '/icons/betabreaker_header.png'
    // If full URL or already absolute path, use as-is
    if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/')) return icon
    // Otherwise treat as filename placed under public/icons
    return `/icons/${icon}`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profile {id === 'me' ? '(You)' : `#${id}`}</h1>
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-full bg-white/10" />
          <div>
            <div className="font-semibold">Climber</div>
            <div className="text-xs text-base-subtext">Badges: {badges.length}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Auth</h2>
        <AuthButtons />
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Badges</h2>
        {badges.length === 0 && <p className="text-base-subtext">No badges yet.</p>}
        {badges.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {badges.map(b => (
              <div key={b.id} className="flex flex-col items-center text-center gap-1">
                <img
                  src={resolveIconUrl(b.icon)}
                  alt={b.name}
                  className="h-16 w-16 rounded object-contain bg-white/10"
                  loading="lazy"
                />
                <div className="text-sm font-medium">{b.name}</div>
                {b.description && (
                  <div className="text-xs text-base-subtext">{b.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
