"use client"
import { useEffect, useState } from 'react'
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
            <OwnLogRow
              key={item.id}
              item={item}
              bumpCount={meBumpCounts[item.id] || 0}
              bumped={!!meBumped[item.id]}
              comments={meComments[item.id] || []}
              commentCount={meCommentCounts[item.id] || 0}
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
            <FollowRow
              key={item.id}
              item={item}
              comments={followingComments[item.id] || []}
              commentCount={followingCommentCounts[item.id] || 0}
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

async function toggleBump(logId: string, current: boolean, comment?: string) {
  const { data: userRes } = await supabase.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) throw new Error('Not signed in')
  if (!current) {
    const { error } = await supabase.from('bumps').insert({ log_id: logId, user_id: uid, comment: comment || null })
    if (error) throw error
    return true
  }
  if (comment && comment.trim()) {
    const { error } = await supabase.from('bumps').upsert({ log_id: logId, user_id: uid, comment }, { onConflict: 'log_id,user_id' })
    if (error) throw error
    return true
  }
  const { error } = await supabase.from('bumps').delete().eq('log_id', logId).eq('user_id', uid)
  if (error) throw error
  return false
}

function OwnLogRow({ item, bumpCount, bumped, comments, commentCount, onBumpChange, onChanged }: { item: OwnItem, bumpCount: number, bumped: boolean, comments: Array<{ user_name: string | null, profile_photo: string | null, comment: string, created_at: string }>, commentCount: number, onBumpChange: (bumped: boolean, delta: number) => void, onChanged: (i: OwnItem) => void }) {
  const [editing, setEditing] = useState(false)
  const [localBumped, setLocalBumped] = useState(bumped)
  const [localCount, setLocalCount] = useState(bumpCount)
  const [comment, setComment] = useState('')
  const [localComments, setLocalComments] = useState(comments)
  const [localCommentCount, setLocalCommentCount] = useState(commentCount)
  const [openComments, setOpenComments] = useState(false)
  useEffect(() => { setLocalBumped(bumped) }, [bumped])
  useEffect(() => { setLocalCount(bumpCount) }, [bumpCount])
  useEffect(() => { setLocalComments(comments) }, [comments])
  useEffect(() => { setLocalCommentCount(commentCount) }, [commentCount])
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-base-subtext">{new Date(item.created_at).toLocaleString()}</div>
          <div className="font-semibold">You {item.attempt_type} {item.climb.name}</div>
          <div className="text-xs text-base-subtext">{item.climb.type} • Grade {item.climb.grade ?? '-'} • {item.climb.gym.name}</div>
        </div>
        <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1 text-sm" onClick={() => setEditing(true)}>Edit</button>
      </div>
      {item.notes && <div className="mt-2 text-sm">{item.notes}</div>}
      <div className="mt-2 flex items-center gap-3 text-sm">
        <button
          className={`rounded-md px-3 py-1 ${localBumped ? 'bg-neon-purple text-white' : 'bg-white/10 hover:bg-white/20'}`}
          onClick={async () => {
            try {
              const now = await toggleBump(item.id, localBumped)
              setLocalBumped(now)
              setLocalCount(c => Math.max(0, c + (now ? 1 : -1)))
              onBumpChange(now, now ? 1 : -1)
            } catch (e: any) { alert(e?.message || 'Failed to bump') }
          }}
        >👊 {localBumped ? 'Bumped' : 'Bump'} · {localCount}</button>
        <div className="hidden flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <div className="hidden flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <div className="hidden flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <div className="hidden flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <div className="comment-bubble flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <div className="comment-bubble flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <div className="comment-bubble flex items-center gap-1 text-base-subtext">
          <span>💬</span>
          <span>{localCommentCount || 0}</span>
        </div>
        <button className="text-base-subtext hover:text-base-text" onClick={() => setOpenComments(v => !v)}>Comments{localCommentCount ? ` (${localCommentCount})` : ''}</button>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/5">
        <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/10 rounded-t-lg" onClick={() => setOpenComments(v => !v)}>
          <span className="font-medium">Comments{localCommentCount ? ` (${localCommentCount})` : ''}</span>
          <span className="text-base-subtext">{openComments ? 'Hide' : 'Show'}</span>
        </button>
        {openComments && (
          <div className="px-3 pb-3 pt-1 grid gap-2">
            {(localComments.length > 0 ? localComments.slice(0, 2) : []).map((c, i) => (
              <div key={i} className="flex">
                <div className="max-w-full rounded-lg bg-black/30 px-3 py-2 text-sm">
                  <span className="font-medium">{c.user_name || 'User'}:</span> {c.comment}
                </div>
              </div>
            ))}
            {localCommentCount > localComments.length && (
              <button className="text-xs text-base-subtext text-left" onClick={async () => {
                const { data } = await supabase
                  .from('bumps')
                  .select('comment, created_at, user:users(name, profile_photo)')
                  .eq('log_id', item.id)
                  .not('comment', 'is', null)
                  .order('created_at', { ascending: false })
                const all = (data || []).map((r: any) => ({
                  user_name: (r as any).user?.name ?? null,
                  profile_photo: (r as any).user?.profile_photo ?? null,
                  comment: (r as any).comment as string,
                  created_at: (r as any).created_at as string,
                }))
                setLocalComments(all)
              }}>View more comments ({Math.max(0, localCommentCount - Math.min(2, localComments.length))})</button>
            )}
            <div className="flex items-center gap-2">
              <input className="input flex-1" placeholder="Say something nice (optional)" value={comment} onChange={e => setComment(e.target.value)} />
              <button className="btn-primary" onClick={async () => {
                if (!comment.trim()) return
                try {
                  const now = await toggleBump(item.id, localBumped, comment)
                  setLocalBumped(now)
                  if (now && !bumped) { setLocalCount(c => c + 1); onBumpChange(true, 1) }
                  setLocalCommentCount(c => c + 1)
                  setLocalComments(prev => [{ user_name: 'You', profile_photo: null, comment, created_at: new Date().toISOString() }, ...prev])
                  setComment('')
                } catch (e: any) { alert(e?.message || 'Failed') }
              }}>Send</button>
            </div>
          </div>
        )}
      </div>
      {editing && <EditLogModal item={item} onClose={() => setEditing(false)} onSaved={onChanged} />}
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

function FollowRow({ item, onLocalUpdate, comments, commentCount }: { item: FollowItem, onLocalUpdate: (i: FollowItem) => void, comments: Array<{ user_name: string | null, profile_photo: string | null, comment: string, created_at: string }>, commentCount: number }) {
  const [count, setCount] = useState(item.bump_count || 0)
  const [bumped, setBumped] = useState(!!item.bumped)
  const [comment, setComment] = useState('')
  const [localComments, setLocalComments] = useState(comments)
  const [localCommentCount, setLocalCommentCount] = useState(commentCount)
  const [openComments, setOpenComments] = useState(false)
  useEffect(() => { setLocalComments(comments) }, [comments])
  useEffect(() => { setLocalCommentCount(commentCount) }, [commentCount])
  return (
    <div className="card">
      <div className="text-sm text-base-subtext">{new Date(item.created_at).toLocaleString()}</div>
      <div className="font-semibold">{item.user_name || 'Climber'} {item.attempt_type} {item.climb_name}</div>
      <div className="text-xs text-base-subtext">{item.type} • Grade {item.grade ?? '-'} • {item.gym_name}</div>
      {item.notes && <div className="mt-1 text-sm">{item.notes}</div>}
      
      <div className="mt-2 flex items-center gap-3 text-sm">
        <button
          className={`rounded-md px-3 py-1 ${bumped ? 'bg-neon-purple text-white' : 'bg-white/10 hover:bg-white/20'}`}
          onClick={async () => {
            try {
              const now = await toggleBump(item.id, bumped)
              setBumped(now)
              const nextCount = Math.max(0, count + (now ? 1 : -1))
              setCount(nextCount)
              onLocalUpdate({ ...item, bumped: now, bump_count: nextCount })
            } catch (e: any) { alert(e?.message || 'Failed to bump') }
          }}
        >👊 {bumped ? 'Bumped' : 'Bump'} · {count}</button>
        <button className="text-base-subtext hover:text-base-text" onClick={() => setOpenComments(v => !v)}>Comments{localCommentCount ? ` (${localCommentCount})` : ''}</button>
      </div>
      
      <div className="mt-3 rounded-lg border border-white/10 bg-white/5">
        <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/10 rounded-t-lg" onClick={() => setOpenComments(v => !v)}>
          <span className="font-medium">Comments{localCommentCount ? ` (${localCommentCount})` : ''}</span>
          <span className="text-base-subtext">{openComments ? 'Hide' : 'Show'}</span>
        </button>
        {openComments && (
          <div className="px-3 pb-3 pt-1 grid gap-2">
            {(localComments.length > 0 ? localComments.slice(0, 2) : []).map((c, i) => (
              <div key={i} className="flex">
                <div className="max-w-full rounded-lg bg-black/30 px-3 py-2 text-sm">
                  <span className="font-medium">{c.user_name || 'User'}:</span> {c.comment}
                </div>
              </div>
            ))}
            {localCommentCount > localComments.length && (
              <button className="text-xs text-base-subtext text-left" onClick={async () => {
                const { data } = await supabase
                  .from('bumps')
                  .select('comment, created_at, user:users(name, profile_photo)')
                  .eq('log_id', item.id)
                  .not('comment', 'is', null)
                  .order('created_at', { ascending: false })
                const all = (data || []).map((r: any) => ({
                  user_name: (r as any).user?.name ?? null,
                  profile_photo: (r as any).user?.profile_photo ?? null,
                  comment: (r as any).comment as string,
                  created_at: (r as any).created_at as string,
                }))
                setLocalComments(all)
              }}>View more comments ({Math.max(0, localCommentCount - Math.min(2, localComments.length))})</button>
            )}
            <div className="flex items-center gap-2">
              <input className="input flex-1" placeholder="Say something nice (optional)" value={comment} onChange={e => setComment(e.target.value)} />
              <button className="btn-primary" onClick={async () => {
                if (!comment.trim()) return
                try {
                  const now = await toggleBump(item.id, bumped, comment)
                  setBumped(now)
                  if (now && !item.bumped) {
                    const nextCount = count + 1
                    setCount(nextCount)
                    onLocalUpdate({ ...item, bumped: true, bump_count: nextCount })
                  }
                  setLocalCommentCount(c => c + 1)
                  setLocalComments(prev => [{ user_name: 'You', profile_photo: null, comment, created_at: new Date().toISOString() }, ...prev])
                  setComment('')
                } catch (e: any) { alert(e?.message || 'Failed') }
              }}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


