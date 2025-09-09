"use client"
import { useEffect, useMemo, useState } from 'react'
import AuthButtons from '@/components/AuthButtons'
import UploadButton from '@/components/UploadButton'
import { supabase } from '@/lib/supabaseClient'
// default runtime

type Profile = {
  id: string
  name: string | null
  profile_photo: string | null
  bio?: string | null
}

export default function ProfilePage({ params }: { params: { id: string } }) {
  const routeId = params.id
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [badges, setBadges] = useState<Array<{ id: string, name: string, icon: string | null, description?: string | null }>>([])

  const [editingName, setEditingName] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const isOwner = useMemo(() => {
    return !!viewerId && !!profile && viewerId === profile.id
  }, [viewerId, profile])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const { data: authData } = await supabase.auth.getUser()
        setViewerId(authData.user?.id ?? null)

        const targetId = routeId === 'me' ? authData.user?.id ?? null : routeId
        if (!targetId) {
          setProfile(null)
          setBadges([])
          return
        }
        await Promise.all([
          loadProfile(targetId),
          loadBadges(targetId),
        ])
      } finally {
        setLoading(false)
      }
    })()
  }, [routeId])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('id,name,profile_photo,bio')
      .eq('id', userId)
      .maybeSingle()
    if (data) {
      setProfile(data as Profile)
      setEditingName((data as Profile).name ?? '')
    } else {
      setProfile({ id: userId, name: null, profile_photo: null })
      setEditingName('')
    }
  }

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

  function displayName(): string {
    if (profile?.name && profile.name.trim().length > 0) return profile.name
    if (profile?.id && profile.id === viewerId) return 'You'
    return 'Climber'
  }

  async function saveName() {
    if (!profile) return
    setSaving(true)
    try {
      const newName = editingName.trim()
      const { error } = await supabase
        .from('users')
        .update({ name: newName })
        .eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, name: newName })
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoUploaded(publicUrl: string) {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ profile_photo: publicUrl })
        .eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, profile_photo: publicUrl })
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update photo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profile</h1>
      <div className="card">
        <div className="flex items-center gap-3">
          {profile?.profile_photo ? (
            <img
              src={profile.profile_photo}
              alt={displayName()}
              className="h-16 w-16 rounded-full object-cover bg-white/10"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-white/10" />
          )}
          <div className="flex-1">
            {!isOwner && (
              <div className="font-semibold">{displayName()}</div>
            )}
            {isOwner && (
              <div className="flex items-center gap-2">
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Your name"
                  className="input w-full max-w-xs"
                />
                <button
                  className="btn-primary"
                  onClick={saveName}
                  disabled={saving}
                >{saving ? 'Saving…' : 'Save'}</button>
              </div>
            )}
            <div className="text-xs text-base-subtext">Badges: {badges.length}</div>
          </div>
        </div>
        {isOwner && (
          <div className="mt-3">
            <UploadButton
              bucket="profile-photos"
              pathPrefix={profile?.id ?? viewerId ?? 'unknown'}
              onUploaded={onPhotoUploaded}
            />
          </div>
        )}
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

