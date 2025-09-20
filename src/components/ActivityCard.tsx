"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type BaseActivity = {
  id: string
  created_at: string
  attempt_type: 'flashed' | 'sent' | 'projected'
  attempts?: number | null
  personal_rating?: number | null
  notes?: string | null
  climb_id?: string
}

type OwnActivity = BaseActivity & {
  climb: {
    name: string
    grade: number | null
    type: string
    color: string | null
    gym: { name: string }
  }
  user?: { profile_photo: string | null }
}

type FollowActivity = BaseActivity & {
  user_id: string
  climb_name: string
  gym_name: string
  grade: number | null
  type: string
  color: string | null
  user_name: string | null
  profile_photo: string | null
  route_setter?: boolean
  bump_count?: number
  bumped?: boolean
}

type GymActivity = BaseActivity & {
  user_id: string
  user_name: string | null
  climb_name: string
  gym_name: string
  grade: number | null
  type: string
  bumped?: boolean
  bump_count?: number
  comments?: any[]
  profile_photo?: string | null
  route_setter?: boolean
}

type ActivityData = OwnActivity | FollowActivity | GymActivity

type Comment = {
  user_name: string | null
  profile_photo: string | null
  comment: string
  created_at: string
  route_setter?: boolean
}

type ActivityCardProps = {
  activity: ActivityData
  variant: 'own' | 'following' | 'gym'
  onBumpChange?: (bumped: boolean, delta: number) => void
  onChanged?: (updated: ActivityData) => void
  onLocalUpdate?: (updated: ActivityData) => void
}

export default function ActivityCard({ activity, variant, onBumpChange, onChanged, onLocalUpdate }: ActivityCardProps) {
  const [authAvatar, setAuthAvatar] = useState<string | null>(null)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const url = (data.user?.user_metadata as any)?.avatar_url || null
        if (url) setAuthAvatar(url)
      } catch {}
    })()
  }, [])
  // Normalize a user photo that may be a URL, data URL, or raw base64
  const normalizePhoto = (photo: string | null | undefined) => {
    if (!photo) return null
    const p = String(photo)
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('/')) {
      return p
    }
    // Assume raw base64 string from DB
    return `data:image/*;base64,${p}`
  }
  const [editing, setEditing] = useState(false)
  const [localBumped, setLocalBumped] = useState(
    variant === 'own' ? false : !!(activity as FollowActivity | GymActivity).bumped
  )
  const [localCount, setLocalCount] = useState(
    variant === 'own' ? 0 : ((activity as FollowActivity | GymActivity).bump_count || 0)
  )
  const [comment, setComment] = useState('')
  const [localComments, setLocalComments] = useState<Comment[]>([])
  const [localCommentCount, setLocalCommentCount] = useState(0)
  const [openComments, setOpenComments] = useState(false)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  // Load comments and following status
  useEffect(() => {
    loadComments()
    if (variant !== 'own' && (activity as FollowActivity | GymActivity).user_id) {
      checkFollowingStatus()
    }
  }, [activity.id])


  async function loadComments() {
    const { data } = await supabase
      .from('bumps')
      .select('log_id, comment, created_at, user:users(name, profile_photo, route_setter)')
      .eq('log_id', activity.id)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
    
    const comments = (data || []).map((r: any) => ({
      user_name: r.user?.name ?? null,
      profile_photo: r.user?.profile_photo ?? null,
      comment: r.comment,
      created_at: r.created_at,
      route_setter: r.user?.route_setter ?? false,
    }))
    
    setLocalComments(comments.slice(0, 2))
    setLocalCommentCount(comments.length)
  }

  async function checkFollowingStatus() {
    const { data: userRes } = await supabase.auth.getUser()
    const me = userRes.user?.id
    if (!me || me === (activity as FollowActivity | GymActivity).user_id) {
      setFollowing(null)
      return
    }
    
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', me)
      .eq('following_id', (activity as FollowActivity | GymActivity).user_id)
      .maybeSingle()
    
    setFollowing(!!data)
  }

  async function toggleBump() {
    setBusy(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes.user?.id
      if (!uid) throw new Error('Not signed in')

      if (!localBumped) {
        const { error } = await supabase.from('bumps').insert({ 
          log_id: activity.id, 
          user_id: uid, 
          comment: comment.trim() || null 
        })
        if (error) throw error
        setLocalBumped(true)
        setLocalCount(c => c + 1)
        onBumpChange?.(true, 1)
      } else {
        if (comment.trim()) {
          const { error } = await supabase.from('bumps').upsert({ 
            log_id: activity.id, 
            user_id: uid, 
            comment: comment.trim() 
          }, { onConflict: 'log_id,user_id' })
          if (error) throw error
        } else {
          const { error } = await supabase.from('bumps').delete()
            .eq('log_id', activity.id)
            .eq('user_id', uid)
          if (error) throw error
          setLocalBumped(false)
          setLocalCount(c => Math.max(0, c - 1))
          onBumpChange?.(false, -1)
        }
      }
      
      if (comment.trim()) {
        const userPhoto = normalizePhoto(variant === 'own' ? ((activity as OwnActivity).user?.profile_photo || authAvatar) : null)
        setLocalComments(prev => [{
          user_name: 'You',
          profile_photo: userPhoto,
          comment: comment.trim(),
          created_at: new Date().toISOString()
        }, ...prev])
        setLocalCommentCount(c => c + 1)
        setComment('')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to bump')
    }
    setBusy(false)
  }

  async function toggleFollow() {
    if (following === null) return
    setBusy(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const me = userRes.user?.id
      if (!me) throw new Error('Sign in')

      const targetUserId = (activity as FollowActivity | GymActivity).user_id
      
      if (!following) {
        const { error } = await supabase.from('follows').insert({
          follower_id: me,
          following_id: targetUserId
        })
        if (error) throw error
        setFollowing(true)
      } else {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', me)
          .eq('following_id', targetUserId)
        if (error) throw error
        setFollowing(false)
      }
    } catch (e: any) {
      alert(e?.message || 'Failed')
    }
    setBusy(false)
  }

  // Get display data based on variant
  const getDisplayData = () => {
    switch (variant) {
      case 'own':
        const own = activity as OwnActivity
        const userPhoto = normalizePhoto(own.user?.profile_photo || authAvatar)
        return {
          userName: 'You',
          userPhoto: userPhoto,
          climbName: own.climb.name,
          climbId: activity.climb_id || '',
          gymName: own.climb.gym.name,
          grade: own.climb.grade,
          type: own.climb.type,
          showEdit: true,
          showFollow: false
        }
      case 'following':
        const follow = activity as FollowActivity
        return {
          userName: follow.user_name || 'Climber',
          userPhoto: follow.profile_photo,
          climbName: follow.climb_name,
          climbId: activity.climb_id || '',
          gymName: follow.gym_name,
          grade: follow.grade,
          type: follow.type,
          showEdit: false,
          showFollow: false
        }
      case 'gym':
        const gym = activity as GymActivity
        return {
          userName: gym.user_name || 'Climber',
          userPhoto: gym.profile_photo,
          climbName: gym.climb_name,
          climbId: activity.climb_id || '',
          gymName: gym.gym_name,
          grade: gym.grade,
          type: gym.type,
          showEdit: false,
          showFollow: following !== null
        }
    }
  }

  const displayData = getDisplayData()

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:border-purple-400/50">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* User Avatar */}
            {displayData.userPhoto ? (
              <img 
                src={displayData.userPhoto} 
                alt="Profile" 
                onError={(e: any) => { try { e.currentTarget.src = '/icons/betabreaker_header.png' } catch {} }}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 ring-2 ring-transparent group-hover:ring-purple-400/30 transition-all duration-300"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-black/10 ring-2 ring-transparent group-hover:ring-purple-400/30 transition-all duration-300">
                <span className="text-white text-sm font-semibold">
                  {displayData.userName[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1">
                {new Date(activity.created_at).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-gray-900">
                  {displayData.userName} {activity.attempt_type}{' '}
                  {displayData.climbId ? (
                    <Link 
                      href={`/climb/${displayData.climbId}`}
                      className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded-lg transition-all duration-200 font-semibold group"
                    >
                      <span>{displayData.climbName}</span>
                      <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  ) : (
                    <span>{displayData.climbName}</span>
                  )}
                </span>
                {((activity as FollowActivity | GymActivity).route_setter) && (
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white text-[10px] font-bold">
                    <span>🧗</span>
                    <span>Setter</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <span>{displayData.type}</span>
                <span className="w-1 h-1 rounded-full bg-gray-400" />
                <span>Grade {displayData.grade ?? '-'}</span>
                <span className="w-1 h-1 rounded-full bg-gray-400" />
                <span>{displayData.gymName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-3">
            {displayData.showEdit && (
              <button 
                className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-purple-100 text-xs font-medium text-gray-700 hover:text-purple-700 transition-colors duration-200"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
            {displayData.showFollow && (
              <button 
                className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-purple-100 text-xs font-medium text-gray-700 hover:text-purple-700 transition-colors duration-200" 
                disabled={busy} 
                onClick={toggleFollow}
              >
                {following ? 'Unfollow' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        {activity.notes && (
          <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-700 leading-relaxed">{activity.notes}</p>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-3 mb-4">
          <button
            className={`group/bump flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              localBumped 
                ? 'bg-gradient-to-r from-purple-400 to-fuchsia-400 text-white shadow-lg shadow-purple-400/40 ring-2 ring-purple-400/30' 
                : 'bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700'
            }`}
            onClick={toggleBump}
            disabled={busy}
          >
            <span className="text-lg group-hover/bump:scale-110 transition-transform duration-200">
              {localBumped ? '👊' : '✊'}
            </span>
            <span className="text-sm">
              {localBumped ? 'Bumped' : 'Bump'} {localCount > 0 && `• ${localCount}`}
            </span>
          </button>

          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 transition-all duration-200"
            onClick={() => setOpenComments(v => !v)}
          >
            <div className="relative">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {localCommentCount > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">{Math.min(localCommentCount, 9)}</span>
                </div>
              )}
            </div>
            <span className="text-sm font-medium">
              {localCommentCount > 0 ? `${localCommentCount}` : 'Comment'}
            </span>
          </button>
        </div>

        {/* Modern Comments Section */}
        {openComments && (
          <div className="space-y-3">
            {/* Comments List */}
            {localComments.length > 0 && (
              <div className="space-y-3">
                {localComments.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 group/comment">
                    {/* Comment Avatar */}
                    {c.profile_photo ? (
                      <img 
                        src={c.profile_photo} 
                        alt="Profile" 
                        onError={(e: any) => { try { e.currentTarget.src = '/icons/betabreaker_header.png' } catch {} }}
                        className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center border border-gray-200 flex-shrink-0">
                        <span className="text-white text-xs font-medium">
                          {(c.user_name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {/* Comment Bubble */}
                    <div className="flex-1 min-w-0">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 backdrop-blur-sm rounded-2xl px-4 py-3 border border-gray-200 group-hover/comment:border-purple-300 transition-colors duration-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">
                            {c.user_name || 'User'}
                          </span>
                          {c.route_setter && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white text-[10px] font-bold">
                              <span>🧗</span>
                              <span>Setter</span>
                            </div>
                          )}
                          <span className="text-xs text-gray-500">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed break-words">
                          {c.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More Comments */}
            {localCommentCount > localComments.length && (
              <button 
                className="text-sm text-gray-600 hover:text-purple-700 transition-colors duration-200"
                onClick={async () => {
                  const { data } = await supabase
                    .from('bumps')
                    .select('comment, created_at, user:users(name, profile_photo, route_setter)')
                    .eq('log_id', activity.id)
                    .not('comment', 'is', null)
                    .order('created_at', { ascending: false })
                  
                  const allComments = (data || []).map((r: any) => ({
                    user_name: r.user?.name ?? null,
                    profile_photo: r.user?.profile_photo ?? null,
                    comment: r.comment,
                    created_at: r.created_at,
                    route_setter: r.user?.route_setter ?? false,
                  }))
                  
                  setLocalComments(allComments)
                }}
              >
                View {localCommentCount - localComments.length} more comments
              </button>
            )}

            {/* Comment Input */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 relative">
                <input 
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent transition-all duration-200"
                  placeholder="Add a thoughtful comment..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>
              <button 
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  comment.trim() 
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                onClick={toggleBump}
                disabled={busy || !comment.trim()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Edit Modal would go here */}
      {editing && variant === 'own' && (
        <div>Edit modal placeholder</div>
      )}
    </div>
  )
}
