"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ActivityCard from '@/components/ActivityCard'

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

export default function FeedPage() {
  const [tab, setTab] = useState<'me'|'following'>('me')
  const [me, setMe] = useState<OwnItem[]>([])
  const [following, setFollowing] = useState<FollowItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [meBumpCounts, setMeBumpCounts] = useState<Record<string, number>>({})
  const [meBumped, setMeBumped] = useState<Record<string, boolean>>({})
  const [meCommentCounts, setMeCommentCounts] = useState<Record<string, number>>({})
  const [meComments, setMeComments] = useState<Record<string, Array<{ user_name: string | null, profile_photo: string | null, comment: string, created_at: string }>>>({})
  const [followingCommentCounts, setFollowingCommentCounts] = useState<Record<string, number>>({})
  const [followingComments, setFollowingComments] = useState<Record<string, Array<{ user_name: string | null, profile_photo: string | null, comment: string, created_at: string }>>>({})
  const PAGE_SIZE = 6
  const [mePage, setMePage] = useState(0)
  const [meHasMore, setMeHasMore] = useState(true)
  const [followingPage, setFollowingPage] = useState(0)
  const [followingHasMore, setFollowingHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        if (tab === 'me') {
          // Reset paging for 'me'
          setMe([]); setMeBumpCounts({}); setMeBumped({}); setMeCommentCounts({}); setMeComments({}); setMePage(0); setMeHasMore(true)
          await fetchMePage(0, mounted)
        } else {
          // Reset paging for 'following'
          setFollowing([]); setFollowingCommentCounts({}); setFollowingComments({}); setFollowingPage(0); setFollowingHasMore(true)
          await fetchFollowingPage(0, mounted)
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load feed')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
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
    setMe(prev => page === 0 ? rows : [...prev, ...rows])
    const ids = rows.map(r => r.id)
    setMeHasMore(rows.length === PAGE_SIZE)
    if (ids.length && userId) {
      const [{ data: bumps }, { data: mine }] = await Promise.all([
        supabase.from('bumps').select('log_id').in('log_id', ids),
        supabase.from('bumps').select('log_id').eq('user_id', userId).in('log_id', ids)
      ])
      const mapC: Record<string, number> = {}
      for (const b of bumps || []) { const k = (b as any).log_id as string; mapC[k] = (mapC[k] || 0) + 1 }
      const mapM: Record<string, boolean> = {}
      for (const m of mine || []) mapM[(m as any).log_id] = true
      setMeBumpCounts(prev => ({ ...prev, ...mapC }))
      setMeBumped(prev => ({ ...prev, ...mapM }))
    }
    if (ids.length) {
      const { data: comments } = await supabase
        .from('bumps')
        .select('log_id, comment, created_at, user:users(name, profile_photo)')
        .in('log_id', ids)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
      const cCounts: Record<string, number> = {}
      const cTop: Record<string, Array<{ user_name: string | null, profile_photo: string | null, comment: string, created_at: string }>> = {}
      for (const r of comments || []) {
        const lid = (r as any).log_id as string
        cCounts[lid] = (cCounts[lid] || 0) + 1
        const entry = { user_name: (r as any).user?.name ?? null, profile_photo: (r as any).user?.profile_photo ?? null, comment: (r as any).comment as string, created_at: (r as any).created_at as string }
        if (!cTop[lid]) cTop[lid] = []
        if (cTop[lid].length < 2) cTop[lid].push(entry)
      }
      setMeCommentCounts(prev => ({ ...prev, ...cCounts }))
      setMeComments(prev => ({ ...prev, ...cTop }))
    }
  }

  async function fetchFollowingPage(page: number, mounted = true) {
    const { data, error } = await supabase.rpc('get_following_logs', { page_size: PAGE_SIZE, page })
    if (error) throw error
    const rows = (data as any as FollowItem[]) || []
    setFollowing(prev => page === 0 ? rows : [...prev, ...rows])
    setFollowingHasMore(rows.length === PAGE_SIZE)
    const ids = rows.map(r => r.id)
    if (ids.length) {
      const { data: comments } = await supabase
        .from('bumps')
        .select('log_id, comment, created_at, user:users(name, profile_photo)')
        .in('log_id', ids)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
      const cCounts: Record<string, number> = {}
      const cTop: Record<string, Array<{ user_name: string | null, profile_photo: string | null, comment: string, created_at: string }>> = {}
      for (const r of comments || []) {
        const lid = (r as any).log_id as string
        cCounts[lid] = (cCounts[lid] || 0) + 1
        const entry = { user_name: (r as any).user?.name ?? null, profile_photo: (r as any).user?.profile_photo ?? null, comment: (r as any).comment as string, created_at: (r as any).created_at as string }
        if (!cTop[lid]) cTop[lid] = []
        if (cTop[lid].length < 2) cTop[lid].push(entry)
      }
      setFollowingCommentCounts(prev => ({ ...prev, ...cCounts }))
      setFollowingComments(prev => ({ ...prev, ...cTop }))
    }
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
              onBumpChange={(bumped, delta) => {
                setMeBumped(prev => ({ ...prev, [item.id]: bumped }))
                setMeBumpCounts(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) + delta) }))
              }}
              onChanged={updated => setMe(prev => prev.map(x => x.id===updated.id? updated: x))}
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
              activity={item}
              variant="following"
              onLocalUpdate={(u) => setFollowing(prev => prev.map(x => x.id === u.id ? u : x))}
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


function EditLogModal({ item, onClose, onSaved }: { item: OwnItem, onClose: () => void, onSaved: (i: OwnItem) => void }) {
  const [attempt_type, setAttemptType] = useState(item.attempt_type)
  const [attempts, setAttempts] = useState<number>(item.attempts ?? 1)
  const [personal_rating, setPersonalRating] = useState<number>((item.personal_rating ?? 3))
  const [community_grade, setCommunityGrade] = useState<number>(item.climb.grade ?? 5)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const { data: updated, error } = await supabase
        .from('climb_logs')
        .update({ attempt_type, attempts: (attempt_type==='sent'? attempts: null), personal_rating, notes: notes || null })
        .eq('id', item.id)
        .select('id, created_at:date, attempt_type, attempts, personal_rating, notes, climb_id, climb:climbs(name, grade, type, color, gym:gyms(name))')
        .single()
      if (error) throw error
      if (community_grade) {
        const { data: authUser } = await supabase.auth.getUser()
        const uid = authUser.user?.id
        if (uid) {
          await supabase.from('community_ratings').upsert({ user_id: uid, climb_id: item.climb_id, rating: community_grade }, { onConflict: 'user_id,climb_id' })
        }
      }
      onSaved(updated as any)
      onClose()
    } catch (e) {
      alert((e as any)?.message || 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <form className="card grid gap-3" onSubmit={save}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Edit Log</h3>
            <button type="button" className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={onClose}>Close</button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-base-subtext">Attempt:</label>
            <label className="flex items-center gap-1 text-sm"><input type="radio" name="attempt2" checked={attempt_type==='flashed'} onChange={() => setAttemptType('flashed')} /> Flashed</label>
            <label className="flex items-center gap-1 text-sm"><input type="radio" name="attempt2" checked={attempt_type==='sent'} onChange={() => setAttemptType('sent')} /> Sent</label>
            <label className="flex items-center gap-1 text-sm"><input type="radio" name="attempt2" checked={attempt_type==='projected'} onChange={() => setAttemptType('projected')} /> Projected</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-base-subtext w-24">Attempts</label>
              <input className="input" type="number" min={1} value={attempts} onChange={e => setAttempts(Math.max(1, Number(e.target.value)))} disabled={attempt_type !== 'sent'} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-base-subtext">Your Rating:</label>
              <StarRating value={personal_rating as any} onChange={v => setPersonalRating(v)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-base-subtext w-32">Community Grade</label>
            <select className="input" value={community_grade} onChange={e => setCommunityGrade(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <textarea className="input" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex items-center justify-end gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StarRating({ value, onChange }: { value: 1|2|3|4|5, onChange: (v: 1|2|3|4|5) => void }) {
  return (
    <div className="flex">
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n as any)} className="px-1">
          <span className={n <= value ? 'text-yellow-400' : 'text-base-subtext'}>★</span>
        </button>
      ))}
    </div>
  )
}
