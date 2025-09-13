"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { VideoAddForm, VideoPreview, isSupportedVideoUrl } from './VideoEmbed'
import { useSearchParams } from 'next/navigation'
import { useBadgeAwardContext } from '@/contexts/BadgeAwardContext'
import { triggerBadgeCheck } from '@/lib/badgeChecker'
const getSupabase = async () => (await import('@/lib/supabaseClient')).supabase

type Climb = { id: string; name: string; grade: number | null; type: 'boulder'|'top_rope'|'lead'; color: string | null; dyno: boolean | null; gym: { id: string, name: string }; community_grade?: number | null }

export default function ClimbDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const qp = useSearchParams()
  const openLog = qp?.get('log') === '1'
  const { awardBadge } = useBadgeAwardContext()
  const [climb, setClimb] = useState<Climb | null>(null)
  const [photos, setPhotos] = useState<Array<{ id: string, image_base64: string | null }>>([])
  const [videos, setVideos] = useState<Array<{ id: string, url: string, user_id?: string | null }>>([])
  const [comments, setComments] = useState<any[]>([])
  const [sends, setSends] = useState<Array<{ user_id: string, user_name: string | null, date: string, attempt_type: 'flashed'|'sent', fa?: boolean }>>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRouteSetter, setIsRouteSetter] = useState(false)
  const [showLog, setShowLog] = useState(openLog)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const supabase = await getSupabase()
      const { data: c } = await supabase
        .from('climbs')
        .select('id,name,grade,type,color,dyno,gym:gyms(id,name)')
        .eq('id', id)
        .maybeSingle()
      if (!mounted) return
      setClimb(c as any)
      
      // Load community rating for this climb
      if (c) {
        try {
          const { data: ratings } = await supabase
            .from('community_ratings')
            .select('rating')
            .eq('climb_id', id)
          
          if (ratings && ratings.length > 0) {
            const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            const communityGrade = Math.round(avg * 10) / 10
            setClimb(prev => prev ? { ...prev, community_grade: communityGrade } : prev)
          }
        } catch (e) {
          console.error('Failed to load community rating:', e)
        }
      }
      
      if ((c as any)?.gym?.id) {
        const { data: ok } = await supabase.rpc('is_gym_admin', { gid: (c as any).gym.id })
        setIsAdmin(!!ok)
      }
      
      // Check if current user is a route setter
      const { data: authUser } = await supabase.auth.getUser()
      if (authUser.user?.id) {
        const { data: userData } = await supabase
          .from('users')
          .select('route_setter')
          .eq('id', authUser.user.id)
          .maybeSingle()
        setIsRouteSetter(!!userData?.route_setter)
      }
      const { data: ph } = await supabase.from('climb_photos').select('id,image_base64').eq('climb_id', id).order('created_at', { ascending: false }).limit(12)
      setPhotos(ph || [])
      // Videos are optional; ignore error if table not present
      try {
        const { data: vids } = await supabase.from('climb_videos').select('id,url,user_id').eq('climb_id', id).order('created_at', { ascending: false })
        setVideos(vids || [])
      } catch { setVideos([]) }
      const { data: cm } = await supabase.from('climb_comments').select('id, user_id, parent_id, body, is_setter, created_at, user:users(name,profile_photo,route_setter)').eq('climb_id', id).order('created_at', { ascending: true })
      setComments(cm || [])
      // Load sends (flashed or sent) for this climb, earliest first
      const { data: sl } = await supabase
        .from('climb_logs')
        .select('user_id, date, attempt_type, user:users(name)')
        .eq('climb_id', id)
        .in('attempt_type', ['flashed','sent'])
        .order('date', { ascending: true })
      let mapped = (sl || []).map((r: any) => ({
        user_id: r.user_id as string,
        user_name: r.user?.name || null,
        date: r.date as string,
        attempt_type: r.attempt_type as 'flashed' | 'sent',
        fa: false
      }))
      // Fallback: if RLS limits visibility, augment via gym activity RPC
      try {
        const gid = (c as any)?.gym?.id as string | undefined
        if (gid) {
          const { data: act } = await supabase.rpc('get_gym_activity', { gid, page_size: 200, page: 0 })
          const extras = (act as any[] | null | undefined)?.filter((row: any) => {
            const isSend = row?.attempt_type === 'flashed' || row?.attempt_type === 'sent'
            const matchById = row?.climb_id ? String(row.climb_id) === String(id) : false
            const matchByName = !matchById && row?.climb_name && (row.climb_name === (c as any)?.name)
            return isSend && (matchById || matchByName)
          }).map((row: any) => ({
            user_id: String(row.user_id || ''),
            user_name: row.user_name || null,
            date: String(row.created_at || row.date || new Date().toISOString()),
            attempt_type: (row.attempt_type === 'flashed' ? 'flashed' : 'sent') as 'flashed' | 'sent',
            fa: false
          })) || []
          // Merge unique by user_id+date
          const key = (x: any) => `${x.user_id}|${x.date}`
          const map: Record<string, any> = {}
          for (const r of [...mapped, ...extras]) map[key(r)] = r
          mapped = Object.values(map).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        }
      } catch { /* noop if RPC not available */ }
      if (mapped.length) mapped[0].fa = true
      setSends(mapped)
    })()
    return () => { mounted = false }
  }, [id])

  const threads = useMemo(() => {
    const byParent: Record<string, any[]> = {}
    for (const c of comments) {
      const p = (c.parent_id as string) || 'root'
      if (!byParent[p]) byParent[p] = []
      byParent[p].push(c)
    }
    return byParent
  }, [comments])

  async function addComment(body: string, parent_id?: string, is_setter?: boolean) {
    const supabase = await getSupabase(); const { data: u } = await supabase.auth.getUser(); const uid = u.user?.id
    if (!uid) return alert('Sign in')
    const { data, error } = await supabase
      .from('climb_comments')
      .insert({ climb_id: id, user_id: uid, body, parent_id: parent_id || null, is_setter: !!is_setter })
      .select('id, user_id, parent_id, body, is_setter, created_at, user:users(name,profile_photo)')
      .single()
    if (error) { alert(error.message); return }
    setComments(prev => [...prev, data as any])
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {climb?.gym && (
          <Link href={`/gym/${climb.gym.id}`} className="text-sm text-base-subtext">← {climb.gym.name}</Link>
        )}
      </div>
      <div className="card">
        <h1 className="text-xl font-bold">{climb?.name || 'Climb'} {climb?.color ? (<span className="inline">{'\u2022'} {climb.color}</span>) : ''}</h1>
        <div className="text-sm text-base-subtext">
          {climb?.type} <span>{'\u2022'}</span> Grade {climb?.grade ?? '-'} 
          {climb?.community_grade && (
            <span className="text-neon-purple"> <span>{'\u2022'}</span> Community: {climb.community_grade}</span>
          )}
          <span> {'\u2022'} </span> {climb?.gym?.name}
        </div>
        <div className="mt-3">
          <button className="btn-primary" onClick={() => setShowLog(true)}>Log this climb</button>
          <button
            className="btn-primary ml-2"
            onClick={() => {
              console.log('🧪 Testing badge popup manually')
              awardBadge({
                id: 'test-badge',
                name: 'Test Badge',
                description: 'This is a test badge to verify the popup works',
                icon: '/icons/betabreaker_header.png'
              })
            }}
          >
            Test Badge
          </button>
        </div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Photos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {photos.map(p => (
            <div key={p.id} className="relative aspect-video bg-white/5 rounded overflow-hidden">
              {p.image_base64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/*;base64,${p.image_base64}`} alt="climb" className="h-full w-full object-cover" />
              )}
              {isAdmin && (
                <button
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white rounded px-2 py-1 text-xs"
                  onClick={async () => {
                    if (!confirm('Delete this photo?')) return
                    const supabase = await getSupabase()
                    const { error } = await supabase.from('climb_photos').delete().eq('id', p.id)
                    if (error) alert(error.message)
                    else setPhotos(prev => prev.filter(x => x.id !== p.id))
                  }}
                >Delete</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Route Setter Notes</h2>
        <div className="space-y-4">
          {comments.filter((x: any) => x.is_setter).length === 0 ? (
            <p className="text-base-subtext text-sm">No setter notes yet.</p>
          ) : (
            comments.filter((x: any) => x.is_setter).map((s: any) => (
              <div key={s.id} className="flex items-start gap-3 group/comment">
                {/* Setter Avatar */}
                {s.user?.profile_photo ? (
                  <img 
                    src={s.user.profile_photo} 
                    alt="Route Setter" 
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center border border-gray-200 flex-shrink-0">
                    <span className="text-white text-xs font-medium">
                      {(s.user?.name || 'S')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Setter Quote Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 backdrop-blur-sm rounded-2xl px-4 py-3 border border-orange-200 group-hover/comment:border-orange-300 transition-colors duration-200 relative">
                    {/* Quote Icon */}
                    <div className="absolute -top-1 -left-1 text-orange-400 text-2xl leading-none">"</div>
                    <div className="flex items-center gap-2 mb-1 ml-4">
                      <span className="font-semibold text-orange-900 text-sm">
                        {s.user?.name || 'Route Setter'}
                      </span>
                      <span className="text-xs text-orange-600 font-medium">• Setter</span>
                      <span className="text-xs text-orange-500">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-orange-800 leading-relaxed break-words italic ml-4">
                      {s.body}
                    </p>
                    {/* Closing Quote */}
                    <div className="absolute -bottom-1 -right-1 text-orange-400 text-2xl leading-none rotate-180">"</div>
                  </div>
                </div>
              </div>
            ))
          )}
          {isRouteSetter && (
            <div className="pt-4 border-t border-orange-200">
              <CommentBox onSubmit={(v) => addComment(v, undefined, true)} placeholder="Add setter note..." />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Videos</h2>
        <VideoAddForm
          onAdd={async (url) => {
            if (!isSupportedVideoUrl(url)) { alert('Only YouTube and Instagram links are supported for now.'); return }
            try {
              const supabase = await getSupabase(); const { data: u } = await supabase.auth.getUser(); const uid = u.user?.id
              if (!uid) { alert('Sign in'); return }
              const { data, error } = await supabase.from('climb_videos').insert({ climb_id: id, url, user_id: uid }).select('id,url,user_id').single()
              if (error) throw error
              setVideos(prev => [data as any, ...prev])
            } catch (e: any) {
              alert(e?.message || 'Failed to add video link. Ensure table "climb_videos" exists with columns (id uuid pk, climb_id uuid, url text, user_id uuid, created_at timestamp default now()).')
            }
          }}
        />
        {videos.length === 0 && <div className="text-sm text-base-subtext">No videos yet.</div>}
        <div className="mt-3 grid gap-3">
          {videos.map(v => (
            <div key={v.id} className="relative rounded-lg overflow-hidden border border-white/5">
              <VideoPreview url={v.url} />
              {(isAdmin) && (
                <button
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white rounded px-2 py-1 text-xs"
                  onClick={async () => {
                    if (!confirm('Delete this video?')) return
                    try {
                      const supabase = await getSupabase()
                      const { error } = await supabase.from('climb_videos').delete().eq('id', v.id)
                      if (error) throw error
                      setVideos(prev => prev.filter(x => x.id !== v.id))
                    } catch (e: any) { alert(e?.message || 'Failed') }
                  }}
                >Delete</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Ascents</h2>
        {sends.length === 0 && (
          <div className="text-base-subtext text-sm">No sends yet.</div>
        )}
        {sends.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-base-subtext">
                <tr>
                  <th className="py-1">User</th>
                  <th className="py-1">Date</th>
                  <th className="py-1">Attempt</th>
                  <th className="py-1">FA</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s, i) => (
                  <tr key={i} className="border-t border-black/10">
                    <td className="py-1">{s.user_name || 'User'}</td>
                    <td className="py-1">{new Date(s.date).toLocaleString()}</td>
                    <td className="py-1 capitalize">{s.attempt_type}</td>
                    <td className="py-1">{s.fa ? 'FA' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Comments</h2>
        <div className="space-y-4">
          {/* Comments List */}
          {(threads['root'] || []).filter((c: any) => !c.is_setter).map((c: any) => (
            <div key={c.id} className="space-y-3">
              {/* Main Comment */}
              <div className="flex items-start gap-3 group/comment">
                {/* Comment Avatar */}
                {c.user?.profile_photo ? (
                  <img 
                    src={c.user.profile_photo} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center border border-gray-200 flex-shrink-0">
                    <span className="text-white text-xs font-medium">
                      {(c.user?.name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Comment Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 backdrop-blur-sm rounded-2xl px-4 py-3 border border-gray-200 group-hover/comment:border-purple-300 transition-colors duration-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">
                        {c.user?.name || 'User'}
                      </span>
                      {c.user?.route_setter && (
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
                      {c.body}
                    </p>
                  </div>
                </div>
              </div>

              {/* Replies */}
              {(threads[c.id] || []).length > 0 && (
                <div className="ml-6 space-y-3 border-l border-gray-200 pl-4">
                  {(threads[c.id] || []).map((r: any) => (
                    <div key={r.id} className="flex items-start gap-3 group/comment">
                      {/* Reply Avatar */}
                      {r.user?.profile_photo ? (
                        <img 
                          src={r.user.profile_photo} 
                          alt="Profile" 
                          className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center border border-gray-200 flex-shrink-0">
                          <span className="text-white text-xs font-medium">
                            {(r.user?.name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      {/* Reply Bubble */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 backdrop-blur-sm rounded-2xl px-4 py-3 border border-gray-200 group-hover/comment:border-purple-300 transition-colors duration-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm">
                              {r.user?.name || 'User'}
                            </span>
                            {r.user?.route_setter && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white text-[10px] font-bold">
                                <span>🧗</span>
                                <span>Setter</span>
                              </div>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(r.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed break-words">
                            {r.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <CommentBox onSubmit={(v) => addComment(v, c.id)} placeholder="Reply..." compact />
                </div>
              )}
              {(threads[c.id] || []).length === 0 && (
                <div className="ml-6 border-l border-gray-200 pl-4">
                  <CommentBox onSubmit={(v) => addComment(v, c.id)} placeholder="Reply..." compact />
                </div>
              )}
            </div>
          ))}

          {/* Add New Comment */}
          <div className="pt-4 border-t border-gray-200">
            <CommentBox onSubmit={(v) => addComment(v)} placeholder="Write a comment..." />
          </div>
        </div>
      </div>


      {showLog && climb && (
        <SendLogModal climbId={climb.id} onClose={() => setShowLog(false)} />
      )}
    </div>
  )
}

function CommentBox({ onSubmit, placeholder, compact }: { onSubmit: (v: string) => void, placeholder: string, compact?: boolean }) {
  const [v, setV] = useState('')
  return (
    <div className={`flex items-center gap-3 ${compact ? 'pt-2' : ''}`}>
      <div className="flex-1 relative">
        <input 
          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent transition-all duration-200"
          placeholder={placeholder}
          value={v}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && v.trim()) {
              onSubmit(v.trim())
              setV('')
            }
          }}
        />
      </div>
      <button 
        className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          v.trim() 
            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
        onClick={() => { 
          if (v.trim()) { 
            onSubmit(v.trim())
            setV('') 
          } 
        }}
        disabled={!v.trim()}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  )
}

function SendLogModal({ climbId, onClose }: { climbId: string, onClose: () => void }) {
  const { awardMultipleBadges } = useBadgeAwardContext()
  const [attempt, setAttempt] = useState<'flashed'|'sent'|'projected'>('sent')
  const [attempts, setAttempts] = useState(1)
  const [rating, setRating] = useState<1|2|3|4|5>(3)
  const [grade, setGrade] = useState(5)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      const supabase = await getSupabase(); const { data: u } = await supabase.auth.getUser(); const uid = u.user?.id
      if (!uid) throw new Error('Not signed in')
      const { error: e1 } = await supabase.from('climb_logs').insert({ user_id: uid, climb_id: climbId, attempt_type: attempt, attempts: attempt==='sent' ? attempts : null, personal_rating: rating, notes: notes || null })
      if (e1) throw e1
      if (grade) {
        await supabase.from('community_ratings').upsert({ user_id: uid, climb_id: climbId, rating: grade }, { onConflict: 'user_id,climb_id' })
      }
      
      // Check for new badges after successful climb log
      console.log('💾 About to trigger badge check for user:', uid)
      await triggerBadgeCheck(uid, awardMultipleBadges)
      
      onClose()
      alert('Logged!')
    } catch (err: any) { alert(err?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <form className="card grid gap-3" onSubmit={save}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Log Send</h3>
            <button type="button" className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={onClose}>Close</button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={attempt==='flashed'} onChange={() => setAttempt('flashed')} /> Flashed</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={attempt==='sent'} onChange={() => setAttempt('sent')} /> Sent</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={attempt==='projected'} onChange={() => setAttempt('projected')} /> Projected</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <label className="text-sm text-base-subtext">Attempts</label>
              <input className="input" type="number" min={1} value={attempts} onChange={e => setAttempts(Math.max(1, Number(e.target.value)))} disabled={attempt!=='sent'} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm text-base-subtext">Community Grade</label>
              <select className="input" value={grade} onChange={e => setGrade(Number(e.target.value) as any)}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-base-subtext">Your Rating</label>
            <StarRating value={rating} onChange={v => setRating(v)} />
          </div>
          <textarea className="input" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex items-center justify-end gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving\\u2026' : 'Save'}</button>
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
          <span className={n <= value ? "text-yellow-400" : "text-base-subtext"}>{n <= value ? "\u2605" : "\u2606"}</span>
        </button>
      ))}
    </div>
  )
}








