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
  const [following, setFollowing] = useState<Array<{ id: string, name: string | null, profile_photo: string | null }>>([])
  const [followers, setFollowers] = useState<Array<{ id: string, name: string | null, profile_photo: string | null }>>([])
  const [followTab, setFollowTab] = useState<'following' | 'followers'>('following')

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
          loadFollowing(targetId),
          loadFollowers(targetId),
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

  async function loadFollowing(userId: string) {
    const { data } = await supabase
      .from('follows')
      .select('following_id, following:users!follows_following_id_fkey(id,name,profile_photo)')
      .eq('follower_id', userId)
    setFollowing((data || []).map((r: any) => r.following).filter(Boolean))
  }

  async function loadFollowers(userId: string) {
    const { data } = await supabase
      .from('follows')
      .select('follower_id, follower:users!follows_follower_id_fkey(id,name,profile_photo)')
      .eq('following_id', userId)
    setFollowers((data || []).map((r: any) => r.follower).filter(Boolean))
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
      {(following.length > 0 || followers.length > 0) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Community</h2>
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  followTab === 'following'
                    ? 'bg-neon-purple text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/10'
                }`}
                onClick={() => setFollowTab('following')}
              >
                Following ({following.length})
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  followTab === 'followers'
                    ? 'bg-neon-purple text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/10'
                }`}
                onClick={() => setFollowTab('followers')}
              >
                Followers ({followers.length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {followTab === 'following' && following.length === 0 && (
              <p className="text-base-subtext text-center py-8">Not following anyone yet</p>
            )}
            {followTab === 'followers' && followers.length === 0 && (
              <p className="text-base-subtext text-center py-8">No followers yet</p>
            )}
            
            {followTab === 'following' && following.map(user => (
              <div key={user.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 hover:from-purple-500/10 hover:to-blue-500/10 border border-white/10 hover:border-purple-400/30 transition-all duration-300">
                {/* User Avatar */}
                {user.profile_photo ? (
                  <img 
                    src={user.profile_photo} 
                    alt={user.name || 'User'} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 ring-2 ring-transparent group-hover:ring-purple-400/40 transition-all duration-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center border-2 border-white/20 ring-2 ring-transparent group-hover:ring-purple-400/40 transition-all duration-300">
                    <span className="text-white font-semibold">
                      {(user.name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 group-hover:text-purple-700 transition-colors duration-200">
                    {user.name || 'Climber'}
                  </div>
                  <div className="text-sm text-gray-500">
                    Following
                  </div>
                </div>

                {/* Action Button */}
                <Link 
                  href={`/profile/${user.id}`}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 font-medium text-sm transition-all duration-200 hover:shadow-md"
                >
                  View Profile
                </Link>
              </div>
            ))}

            {followTab === 'followers' && followers.map(user => (
              <div key={user.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 hover:from-purple-500/10 hover:to-blue-500/10 border border-white/10 hover:border-purple-400/30 transition-all duration-300">
                {/* User Avatar */}
                {user.profile_photo ? (
                  <img 
                    src={user.profile_photo} 
                    alt={user.name || 'User'} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 ring-2 ring-transparent group-hover:ring-purple-400/40 transition-all duration-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center border-2 border-white/20 ring-2 ring-transparent group-hover:ring-purple-400/40 transition-all duration-300">
                    <span className="text-white font-semibold">
                      {(user.name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 group-hover:text-purple-700 transition-colors duration-200">
                    {user.name || 'Climber'}
                  </div>
                  <div className="text-sm text-gray-500">
                    Follows you
                  </div>
                </div>

                {/* Action Button */}
                <Link 
                  href={`/profile/${user.id}`}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 font-medium text-sm transition-all duration-200 hover:shadow-md"
                >
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

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

