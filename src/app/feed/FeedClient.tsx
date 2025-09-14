"use client"
import { useEffect, useState } from 'react'
import ActivityCard from '@/components/ActivityCard'
import { supabase } from '@/lib/supabaseClient'

type OwnItem = {
  id: string
  created_at: string
  attempt_type: 'flashed'|'sent'|'projected'
  attempts: number | null
  personal_rating: number | null
  notes: string | null
  climb_id: string
  climb: { name: string, grade: number|null, type: string, color: string|null, gym: { name: string } }
}

type FollowItem = {
  id: string
  created_at: string
  attempt_type: string
  attempts: number | null
  personal_rating: number | null
  notes: string | null
  user_id: string
  climb_id: string
  climb_name: string
  gym_name: string
  grade: number | null
  type: string
  color: string | null
  user_name: string | null
  profile_photo: string | null
  bump_count?: number
  bumped?: boolean
}

const PAGE_SIZE = 6

export default function FeedClient({ initialUserId, initialMe, initialFollowing = [], initialTab = 'me' as 'me'|'following' }: { initialUserId: string | null, initialMe: OwnItem[], initialFollowing?: FollowItem[], initialTab?: 'me'|'following' }) {
  const [tab, setTab] = useState<'me'|'following'>(initialTab)
  const [userId, setUserId] = useState<string | null>(initialUserId)
  const [me, setMe] = useState<OwnItem[]>(initialMe || [])
  const [following, setFollowing] = useState<FollowItem[]>(initialFollowing || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mePage, setMePage] = useState(0)
  const [meHasMore, setMeHasMore] = useState((initialMe || []).length === PAGE_SIZE)
  const [followingPage, setFollowingPage] = useState(0)
  const [followingHasMore, setFollowingHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    // Ensure user id stays in sync if auth changes
    setUserId(initialUserId)
  }, [initialUserId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        if (tab === 'me') {
          if (me.length === 0) {
            await fetchMePage(0, mounted)
          }
        } else {
          if (following.length === 0) {
            setFollowingPage(0); setFollowingHasMore(true)
            await fetchFollowingPage(0, mounted)
          }
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load feed')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId])

  async function fetchMePage(page: number, mounted = true) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('climb_logs')
      .select('id, created_at:date, attempt_type, attempts, personal_rating, notes, climb_id, climb:climbs(name, grade, type, color, gym:gyms(name))')
      .order('date', { ascending: false })
      .range(from, to)
    if (error) throw error
    const rows = (data as any as OwnItem[]) || []
    if (!mounted) return
    setMe(prev => page === 0 ? rows : [...prev, ...rows])
    setMeHasMore(rows.length === PAGE_SIZE)
  }

  async function fetchFollowingPage(page: number, mounted = true) {
    // keep as client-only for now; not critical for initial load
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase.rpc('get_following_logs', { page_size: PAGE_SIZE, page })
    if (error) throw error
    const rows = (data as any[] || []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      attempt_type: r.attempt_type,
      attempts: r.attempts,
      personal_rating: r.personal_rating,
      notes: r.notes,
      user_id: String(r.user_id),
      climb_id: String(r.climb_id),
      climb_name: r.climb_name,
      gym_name: r.gym_name,
      grade: r.grade,
      type: r.type,
      color: r.color,
      user_name: r.user_name,
      profile_photo: r.profile_photo,
    })) as FollowItem[]
    if (!mounted) return
    setFollowing(prev => page === 0 ? rows : [...prev, ...rows])
    setFollowingHasMore(rows.length === PAGE_SIZE)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Activity Feed</h1>
        <div className="ml-auto flex gap-2 text-sm">
          <button className={`px-3 py-1 rounded ${tab==='me'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setTab('me')}>My Activity</button>
          <button className={`px-3 py-1 rounded ${tab==='following'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setTab('following')}>Following</button>
        </div>
      </div>

      {loading && <div className="card text-base-subtext">Loading…</div>}
      {error && <div className="card text-red-400">{error}</div>}

      {!loading && !error && tab==='me' && (
        <div className="grid gap-2">
          {me.length === 0 && <div className="card text-base-subtext">No logs yet. Log your first climb!</div>}
          {me.map(item => (
            <ActivityCard
              key={item.id}
              activity={item}
              variant="own"
            />
          ))}
          {meHasMore && (
            <button
              className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-2 text-sm"
              disabled={loadingMore}
              onClick={async () => { setLoadingMore(true); try { await fetchMePage(mePage + 1); setMePage(p => p + 1) } finally { setLoadingMore(false) } }}
            >{loadingMore ? 'Loading…' : 'Load more'}</button>
          )}
        </div>
      )}

      {!loading && !error && tab==='following' && (
        <div className="grid gap-2">
          {following.length === 0 && <div className="card text-base-subtext">No activity from people you follow.</div>}
          {following.map(item => (
            <ActivityCard
              key={item.id}
              activity={item as any}
              variant="following"
            />
          ))}
          {followingHasMore && (
            <button
              className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-2 text-sm"
              disabled={loadingMore}
              onClick={async () => { setLoadingMore(true); try { await fetchFollowingPage(followingPage + 1); setFollowingPage(p => p + 1) } finally { setLoadingMore(false) } }}
            >{loadingMore ? 'Loading…' : 'Load more'}</button>
          )}
        </div>
      )}
    </div>
  )
}
