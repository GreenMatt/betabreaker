"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useFocusTick } from '@/lib/useFocusTick'

type Profile = {
  id: string
  name: string | null
  profile_photo: string | null
  bio?: string | null
  route_setter?: boolean
}

type UserLite = { id: string, name: string | null, profile_photo: string | null }

export default function ProfileClient({
  viewerId,
  initialProfile,
  initialEarnedBadges,
  initialAvailableBadges,
  initialFollowing,
  initialFollowers,
}: {
  viewerId: string | null
  initialProfile: Profile | null
  initialEarnedBadges: Array<{ id: string, name: string, icon: string | null, description?: string | null }>
  initialAvailableBadges: Array<{ id: string, name: string, icon: string | null, description?: string | null }>
  initialFollowing: UserLite[]
  initialFollowers: UserLite[]
}) {
  const router = useRouter()
  const focusTick = useFocusTick(250)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [earnedBadges] = useState(initialEarnedBadges)
  const [availableBadges] = useState(initialAvailableBadges)
  const [following] = useState<UserLite[]>(initialFollowing)
  const [followers] = useState<UserLite[]>(initialFollowers)
  const [editingName, setEditingName] = useState<string>(initialProfile?.name || '')
  const [saving, setSaving] = useState(false)
  const [followTab, setFollowTab] = useState<'following'|'followers'>('following')
  const [badgeTab, setBadgeTab] = useState<'earned'|'available'>('earned')

  const isOwner = useMemo(() => !!viewerId && !!profile && viewerId === profile.id, [viewerId, profile])

  // Revalidate on tab return without changing layout
  useEffect(() => { try { router.refresh() } catch {} }, [focusTick, router])

  function displayName(): string {
    if (profile?.name && profile.name.trim().length > 0) return profile.name
    if (profile?.id && profile.id === viewerId) return 'You'
    return 'Climber'
  }

  function resolveIconUrl(icon: string | null): string {
    if (!icon) return '/icons/betabreaker_header.png'
    if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/')) return icon
    return `/icons/${icon}`
  }

  async function saveName() {
    if (!profile) return
    setSaving(true)
    try {
      const newName = editingName.trim()
      const { error } = await supabase.from('users').update({ name: newName }).eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, name: newName })
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const onImgError = (e: any) => { try { e.currentTarget.src = '/icons/betabreaker_header.png' } catch {} }

  if (!profile) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Profile not found.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center gap-4">
          {profile.profile_photo ? (
            <img src={profile.profile_photo} onError={onImgError} alt={displayName()} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-lg font-semibold">{displayName()[0]}</span>
            </div>
          )}
          <div className="flex-1">
            {!isOwner && <div className="text-lg font-semibold">{displayName()}</div>}
            {isOwner && (
              <div className="flex gap-2 items-center">
                <input className="input" value={editingName} onChange={e => setEditingName(e.target.value)} placeholder="Your name" />
                <button className="btn-primary" onClick={saveName} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Badges</h2>
          <div className="flex gap-2 text-sm">
            <button className={`px-3 py-1 rounded ${badgeTab==='earned'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setBadgeTab('earned')}>Earned ({earnedBadges.length})</button>
            <button className={`px-3 py-1 rounded ${badgeTab==='available'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setBadgeTab('available')}>Available ({availableBadges.length})</button>
          </div>
        </div>
        {badgeTab === 'earned' && earnedBadges.length === 0 && <p className="text-base-subtext">No badges earned yet.</p>}
        {badgeTab === 'available' && availableBadges.length === 0 && <p className="text-base-subtext">No badges available.</p>}
        {badgeTab === 'earned' && earnedBadges.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {earnedBadges.map(b => (
              <div key={b.id} className="flex flex-col items-center text-center gap-1">
                <img src={resolveIconUrl(b.icon)} alt={b.name} className="h-16 w-16 rounded object-contain bg-white/10" loading="lazy" onError={onImgError} />
                <div className="text-sm font-medium">{b.name}</div>
                {b.description && <div className="text-xs text-base-subtext">{b.description}</div>}
              </div>
            ))}
          </div>
        )}
        {badgeTab === 'available' && availableBadges.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {availableBadges.map(b => {
              const isEarned = earnedBadges.some(eb => eb.id === b.id)
              return (
                <div key={b.id} className={`flex flex-col items-center text-center gap-1 ${isEarned ? 'opacity-50' : ''}`}>
                  <img src={resolveIconUrl(b.icon)} alt={b.name} className="h-16 w-16 rounded object-contain bg-white/10" loading="lazy" onError={onImgError} />
                  <div className="text-sm font-medium">{b.name}</div>
                  {b.description && <div className="text-xs text-base-subtext">{b.description}</div>}
                  {isEarned && <div className="text-xs text-green-400">✓ Earned</div>}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Connections</h2>
        <div className="flex items-center gap-2 mb-3">
          <button className={`px-4 py-2 rounded-md text-sm ${followTab==='following'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setFollowTab('following')}>Following ({following.length})</button>
          <button className={`px-4 py-2 rounded-md text-sm ${followTab==='followers'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setFollowTab('followers')}>Followers ({followers.length})</button>
        </div>
        <div className="space-y-2">
          {followTab === 'following' && following.length === 0 && <div className="text-base-subtext">Not following anyone yet.</div>}
          {followTab === 'followers' && followers.length === 0 && <div className="text-base-subtext">No followers yet.</div>}
          {followTab === 'following' && following.map(u => (
            <div key={u.id} className="flex items-center gap-3">
              <img src={u.profile_photo || '/icons/betabreaker_header.png'} onError={onImgError} alt={u.name || 'User'} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="font-medium">{u.name || 'Climber'}</div>
              </div>
              <Link className="text-sm text-neon-purple" href={`/profile/${u.id}`}>View</Link>
            </div>
          ))}
          {followTab === 'followers' && followers.map(u => (
            <div key={u.id} className="flex items-center gap-3">
              <img src={u.profile_photo || '/icons/betabreaker_header.png'} onError={onImgError} alt={u.name || 'User'} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="font-medium">{u.name || 'Climber'}</div>
              </div>
              <Link className="text-sm text-neon-purple" href={`/profile/${u.id}`}>View</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
