"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Gym = { id: string; name: string; location: string | null }
type Climb = { id: string; name: string; grade: number | null; type: 'boulder' | 'top_rope' | 'lead'; location: string | null; setter: string | null; color: string | null; dyno: boolean | null; section_id: string | null; section?: { name: string } | null }
type Section = { id: string; name: string }
type Photo = { id: string; climb_id: string; image_base64: string | null; created_at?: string }

export default function GymDetailPage({ params }: { params: { id: string } }) {
  const gid = params.id
  const [gym, setGym] = useState<Gym | null>(null)
  const [climbs, setClimbs] = useState<Climb[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({})
  const [previews, setPreviews] = useState<Record<string, string | null>>({})
  const [lightbox, setLightbox] = useState<{ climbId: string, idx: number, photos: Photo[] } | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [editing, setEditing] = useState<{ open: boolean, climb: Climb | null, form: any }>({ open: false, climb: null, form: null })
  const [activity, setActivity] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [followingUsers, setFollowingUsers] = useState<Array<{ id: string, name: string | null, profile_photo: string | null }>>([])
  const [viewTab, setViewTab] = useState<'active'|'removed'>('active')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const [gRes, cRes, aRes, sRes] = await Promise.all([
        supabase.from('gyms').select('id,name,location').eq('id', gid).maybeSingle(),
        supabase.from('climbs').select('id,name,grade,type,location,setter,color,dyno,section_id,active_status,section:gym_sections(name)').eq('gym_id', gid).order('created_at', { ascending: false }).limit(30),
        supabase.rpc('is_gym_admin', { gid }),
        supabase.from('gym_sections').select('id,name').eq('gym_id', gid).order('name', { ascending: true })
      ])
      if (!mounted) return
      if (gRes.error) setError(gRes.error.message)
      else setGym(gRes.data)
      if (cRes.error) setError(cRes.error.message)
      else {
        const raw = (cRes.data || []) as any[]
        // Normalize section to object (not array) to match Climb type
        const list: Climb[] = raw.map((x: any) => ({
          id: x.id,
          name: x.name,
          grade: x.grade,
          type: x.type,
          location: x.location,
          setter: x.setter,
          color: x.color,
          dyno: x.dyno,
          section_id: x.section_id,
          section: Array.isArray(x.section)
            ? (x.section[0] ? { name: String(x.section[0]?.name ?? '') } : null)
            : (x.section ? { name: String(x.section?.name ?? '') } : null)
        }))
        setClimbs(list)
        const ids = list.map((x: any) => x.id)
        if (ids.length) {
          const { data: photos } = await supabase
            .from('climb_photos')
            .select('id, climb_id, created_at')
            .in('climb_id', ids)
            .order('created_at', { ascending: false })
          const counts: Record<string, number> = {}
          const previewMap: Record<string, string | null> = {}
          for (const p of photos || []) {
            const cid = (p as any).climb_id as string
            counts[cid] = (counts[cid] || 0) + 1
            // Skip heavy base64 preload; previews lazy-loaded per card if needed
          }
          if (mounted) {
            setPhotoCounts(counts)
            setPreviews(previewMap)
            // Warm up previews for top few climbs
            const topIds = list.slice(0, 6).map((x: any) => x.id)
            topIds.forEach((cid: string) => { if (previewMap[cid] === undefined) fetchPreview(cid) })
          }
        } else {
          setPhotoCounts({})
          setPreviews({})
        }
      }
      if (!aRes.error) setIsAdmin(Boolean(aRes.data))
      if (!sRes.error) setSections(sRes.data || [])
      // Load recent activity and following (non-blocking)
      loadActivity().catch(() => {})
      loadFollowing().catch(() => {})
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [gid])

  async function loadActivity() {
    setActivityLoading(true)
    const { data, error } = await supabase.rpc('get_gym_activity', { gid, page_size: 20, page: 0 })
    if (!error) setActivity(data || [])
    setActivityLoading(false)
  }

  async function loadFollowing() {
    const { data: uidRes } = await supabase.auth.getUser()
    const me = uidRes.user?.id
    if (!me) { setFollowingUsers([]); return }
    const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', me)
    const ids = (rows || []).map((r: any) => r.following_id)
    if (ids.length === 0) { setFollowingUsers([]); return }
    const { data: users } = await supabase.from('users').select('id,name,profile_photo').in('id', ids)
    setFollowingUsers(users || [])
  }

  const [form, setForm] = useState({ name: '', type: 'boulder' as 'boulder' | 'top_rope' | 'lead', grade: 5, location: '', setter: '', color: 'blue', dyno: false, section_id: '', active_status: true })
  const canCreate = isAdmin && !loading

  async function createClimb(e: React.FormEvent) {
    e.preventDefault()
    if (!canCreate) return
    const selSection = sections.find(s => s.id === form.section_id)
    const payload = {
      gym_id: gid,
      name: form.name.trim(),
      grade: form.grade,
      type: form.type,
      location: selSection?.name || form.location || null,
      setter: form.setter || null,
      color: form.color || null,
      dyno: form.dyno,
      section_id: form.section_id || null,
      active_status: form.active_status
    }
    const { error } = await supabase.from('climbs').insert(payload)
    if (error) {
      alert(error.message)
      return
    }
    setForm({ name: '', type: 'boulder', grade: 5, location: '', setter: '', color: 'blue', dyno: false, section_id: '', active_status: true })
    const { data } = await supabase.from('climbs').select('id,name,grade,type,location,setter,color,dyno,section_id,active_status,section:gym_sections(name)').eq('gym_id', gid).order('created_at', { ascending: false })
    setClimbs(data || [])
  }

  async function claimAdmin() {
    setClaiming(true)
    const { data, error } = await supabase.rpc('claim_gym_admin', { gid })
    setClaiming(false)
    if (error) {
      alert(error.message)
      return
    }
    if (data) setIsAdmin(true)
  }

  async function deleteClimb(id: string) {
    if (!isAdmin) return
    if (!confirm('Delete this climb? This cannot be undone.')) return
    const { error } = await supabase.from('climbs').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setClimbs(prev => prev.filter(c => c.id !== id))
  }

  function addPhoto(climbId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const base64 = await compressToBase64(file, 1280, 0.8)
        const { data, error } = await supabase.from('climb_photos').insert({ climb_id: climbId, image_base64: base64 }).select('id, climb_id, image_base64, created_at').single()
        if (error) alert(error.message)
        else {
          alert('Photo added')
          setPhotoCounts(pc => ({ ...pc, [climbId]: (pc[climbId] || 0) + 1 }))
          setPreviews(prev => ({ ...prev, [climbId]: 'data:image/*;base64,' + (data as any).image_base64 }))
        }
      } catch (e: any) {
        alert(e?.message || 'Failed to add photo')
      }
    }
    input.click()
  }

  async function fetchPreview(climbId: string) {
    const { data } = await supabase
      .from('climb_photos')
      .select('image_base64, created_at')
      .eq('climb_id', climbId)
      .order('created_at', { ascending: false })
      .limit(1)
    const b64 = data && (data[0] as any)?.image_base64
    const preview = b64 ? `data:image/*;base64,${b64}` : null
    setPreviews(prev => ({ ...prev, [climbId]: preview }))
  }

  async function quickLog(climbId: string, defaults?: { attempts?: number, rating?: number, notes?: string, grade?: number }) {
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) { alert('Please sign in'); return }
    const { error: logErr } = await supabase.from('climb_logs').insert({
      user_id: uid,
      climb_id: climbId,
      attempt_type: 'sent',
      attempts: defaults?.attempts ?? 1,
      personal_rating: (defaults?.rating as any) ?? 3,
      notes: defaults?.notes || null
    })
    if (logErr) { alert(logErr.message); return }
    if (typeof defaults?.grade === 'number') {
      await supabase.from('community_ratings').upsert({ user_id: uid, climb_id: climbId, rating: defaults.grade }, { onConflict: 'user_id,climb_id' })
    }
    loadActivity().catch(() => {})
    alert('Logged!')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/gym" className="text-sm text-base-subtext">← All Gyms</Link>
      </div>
      {loading && <div className="card text-base-subtext">Loading…</div>}
      {error && <div className="card text-red-400">{error}</div>}
      {gym && (
        <div className="card">
          <h1 className="text-xl font-bold">{gym.name}</h1>
          {gym.location && <div className="text-sm text-base-subtext">{gym.location}</div>}
          {!isAdmin && (
            <div className="mt-3">
              <button className="btn-primary" onClick={claimAdmin} disabled={claiming}> {claiming ? 'Claiming…' : 'Claim Admin (if unclaimed)'} </button>
            </div>
          )}
        </div>
      )}

      {canCreate && (
        <form className="card grid gap-2" onSubmit={createClimb}>
          <h2 className="font-semibold">Add Climb</h2>
          <input className="input" placeholder="Climb name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
              <option value="boulder">Boulder</option>
              <option value="top_rope">Top Rope</option>
              <option value="lead">Lead</option>
            </select>
            <input className="input" placeholder="Grade (1-10)" type="number" min={1} max={10} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}>
              <option value="">Select section…</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Or section name" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <input className="input" placeholder="Setter (optional)" value={form.setter} onChange={e => setForm(f => ({ ...f, setter: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
              {['black','yellow','pink','teal','blue','purple','red','green'].map(c => (
                <option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-base-subtext">
              <input type="checkbox" checked={form.dyno} onChange={e => setForm(f => ({ ...f, dyno: e.target.checked }))} />
              Dyno
            </label>
          </div>
          <button className="btn-primary">Create Climb</button>
        </form>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Climbs</h2>
          <div className="ml-auto flex gap-2 text-sm">
            <button className={`px-3 py-1 rounded ${viewTab==='active'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setViewTab('active')}>Active</button>
            <button className={`px-3 py-1 rounded ${viewTab==='removed'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setViewTab('removed')}>Removed</button>
          </div>
        </div>
        {climbs.length === 0 && <div className="card text-base-subtext">No climbs yet.</div>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {climbs.map(c => {
            if ((c as any).active_status === false && viewTab === 'active') return null
            if (((c as any).active_status ?? true) === true && viewTab === 'removed') return null
            const preview = previews[c.id]
            const colorMap: Record<string, string> = { black:'#000000', yellow:'#FFD60A', pink:'#FF6EA0', teal:'#14B8A6', blue:'#3B82F6', purple:'#8B5CF6', red:'#EF4444', green:'#22C55E' }
            const dot = c.color ? (colorMap[c.color] || '#8A2BE2') : '#8A2BE2'
            return (
              <div key={c.id} className="group relative rounded-xl overflow-hidden border border-white/5 bg-base-panel shadow min-h-[320px]">
                <button className="block w-full" onClick={async () => {
                  // Load full gallery for this climb
                  const { data } = await supabase.from('climb_photos').select('id, climb_id, image_base64, created_at').eq('climb_id', c.id).order('created_at', { ascending: false })
                  setLightbox({ climbId: c.id, idx: 0, photos: (data || []) as Photo[] })
                }}>
                  <div className="aspect-video w-full bg-white/5">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt={c.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full grid place-items-center bg-gradient-to-br from-neon-purple/30 to-transparent">
                        <div className="text-center text-sm text-base-subtext">
                          No photo yet
                        </div>
                      </div>
                    )}
                  </div>
                </button>
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button className="btn-primary px-2 py-1 text-xs" onClick={() => addPhoto(c.id)}>Add Photo</button>
                  {isAdmin && <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs" onClick={() => deleteClimb(c.id)}>Delete</button>}
                </div>
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
                  <Link href={`/climb/${c.id}?log=1`} className="bg-neon-purple text-white rounded-md px-3 py-1 text-xs">Log Send</Link>
                </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: dot }} />
                <Link href={`/climb/${c.id}`} className="font-semibold truncate hover:underline">{c.name}</Link>
                {c.dyno ? <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10">Dyno</span> : null}
              </div>
              <div className="mt-1 text-xs text-base-subtext">{c.type} • Grade {c.grade ?? '-'} {c.section?.name ? `• ${c.section.name}` : c.location ? `• ${c.location}` : ''}</div>
            </div>
            {isAdmin && (
              <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition">
                <button className="bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 text-xs" onClick={() => setEditing({ open: true, climb: c, form: { name: c.name, type: c.type, grade: c.grade ?? 5, setter: c.setter ?? '', section_id: c.section_id ?? '', location: c.location ?? '', color: c.color ?? 'blue', dyno: !!c.dyno, active_status: (c as any).active_status ?? true } })}>Edit</button>
              </div>
            )}
            </div>
          )
        })}
      </div>
      <div className="card mt-4">
        <h2 className="font-semibold mb-2">Recent Activity</h2>
        {activityLoading && <div className="text-base-subtext">Loading…</div>}
        {!activityLoading && activity.length === 0 && <div className="text-base-subtext">No activity yet.</div>}
        <ul className="divide-y divide-black/10">
          {activity.map((a) => (
            <GymActivityItem key={a.id} item={a} onChanged={() => loadActivity()} />
          ))}
        </ul>
      </div>

      {followingUsers.length > 0 && (
        <div className="card mt-4">
          <h2 className="font-semibold mb-2">You follow</h2>
          <div className="flex flex-wrap gap-2">
            {followingUsers.map(u => (
              <span key={u.id} className="px-2 py-1 rounded-full bg-white/10 text-sm">{u.name || 'User'}</span>
            ))}
          </div>
        </div>
      )}
    </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-video w-full bg-white/5 rounded-xl overflow-hidden">
              {lightbox.photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/*;base64,${lightbox.photos[lightbox.idx].image_base64 || ''}`} alt="climb photo" className="h-full w-full object-contain" />
              ) : (
                <div className="h-full w-full grid place-items-center text-base-subtext">No photos yet</div>
              )}
              <button className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={() => setLightbox(null)}>Close</button>
              {lightbox.photos.length > 1 && (
                <>
                  <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full h-9 w-9" onClick={() => setLightbox(lb => lb ? ({ ...lb, idx: (lb.idx - 1 + lb.photos.length) % lb.photos.length }) : lb)}>
                    ‹
                  </button>
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full h-9 w-9" onClick={() => setLightbox(lb => lb ? ({ ...lb, idx: (lb.idx + 1) % lb.photos.length }) : lb)}>
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-base-subtext">{photoCounts[lightbox.climbId] ? `${photoCounts[lightbox.climbId]} photo${photoCounts[lightbox.climbId] > 1 ? 's' : ''}` : 'No photos'}</div>
              <div className="flex items-center gap-2">
                <button className="btn-primary px-3 py-1" onClick={() => addPhoto(lightbox.climbId)}>Add Photo</button>
                {isAdmin && <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-3 py-1" onClick={() => setLightbox(null)}>Manage</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <h2 className="font-semibold mb-2">Manage Sections/Walls</h2>
          <SectionManager
            gymId={gid}
            sections={sections}
            onAdded={(s) => setSections(prev => [...prev, s])}
            onRenamed={(id, name) => setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s))}
            onDeleted={(id) => setSections(prev => prev.filter(s => s.id !== id))}
          />
        </div>
      )}

      {editing.open && editing.climb && (
        <EditClimbModal
          sections={sections}
          initial={editing}
          onClose={() => setEditing({ open: false, climb: null, form: null })}
          onSaved={(updated) => {
            setClimbs(prev => prev.map(c => c.id === updated.id ? updated : c))
            setEditing({ open: false, climb: null, form: null })
          }}
          gid={gid}
        />
      )}
    </div>
  )
}

function SectionManager({ gymId, sections, onAdded, onRenamed, onDeleted }: { gymId: string, sections: Section[], onAdded: (s: Section) => void, onRenamed: (id: string, name: string) => void, onDeleted: (id: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function addSection(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('gym_sections').insert({ gym_id: gymId, name: name.trim() }).select('id,name').single()
    setBusy(false)
    if (error) { alert(error.message); return }
    onAdded(data as any)
    setName('')
  }
  return (
    <div className="grid gap-2">
      <form onSubmit={addSection} className="flex gap-2">
        <input className="input flex-1" placeholder="New section/wall name" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn-primary" disabled={busy || !name.trim()}>Add</button>
      </form>
      {sections.length > 0 && (
        <div className="border border-white/5 rounded-lg divide-y divide-white/5">
          {sections.map(s => (
            <SectionRow key={s.id} section={s} onRenamed={onRenamed} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}

async function compressToBase64(file: File, maxSize = 1280, quality = 0.8): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  let { width, height } = img
  const scale = Math.min(1, maxSize / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)
  canvas.width = width
  canvas.height = height
  ctx.drawImage(img, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.split(',')[1]
}

function SectionRow({ section, onRenamed, onDeleted }: { section: Section, onRenamed: (id: string, name: string) => void, onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(section.name)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const { error } = await supabase.from('gym_sections').update({ name }).eq('id', section.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onRenamed(section.id, name)
    setEditing(false)
  }
  async function remove() {
    if (!confirm('Delete section? Climbs will keep their previous location text.')) return
    setBusy(true)
    const { error } = await supabase.from('gym_sections').delete().eq('id', section.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onDeleted(section.id)
  }
  return (
    <div className="p-2 flex items-center gap-2">
      {editing ? (
        <>
          <input className="input flex-1" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn-primary px-3 py-1" onClick={save} disabled={busy || !name.trim()}>Save</button>
          <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <div className="flex-1">{section.name}</div>
          <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={() => setEditing(true)}>Rename</button>
          <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-3 py-1" onClick={remove}>Delete</button>
        </>
      )}
    </div>
  )
}

function EditClimbModal({ initial, onClose, onSaved, gid, sections }: { initial: { open: boolean, climb: Climb, form: any }, onClose: () => void, onSaved: (c: Climb) => void, gid: string, sections: Section[] }) {
  const [form, setForm] = useState({ ...initial.form })
  const [busy, setBusy] = useState(false)
  const colorOptions = ['black','yellow','pink','teal','blue','purple','red','green']
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const selSection = sections.find(s => s.id === form.section_id)
    const update = {
      name: form.name.trim(),
      type: form.type,
      grade: form.grade,
      setter: form.setter || null,
      color: form.color || null,
      dyno: !!form.dyno,
      section_id: form.section_id || null,
      location: selSection?.name || form.location || null,
      active_status: form.active_status !== false
    }
    const { data, error } = await supabase.from('climbs').update(update).eq('id', initial.climb.id).select('id,name,grade,type,location,setter,color,dyno,section_id,section:gym_sections(name)').single()
    setBusy(false)
    if (error) { alert(error.message); return }
    onSaved(data as any)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <form className="card grid gap-2" onSubmit={save}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Edit Climb</h3>
            <button type="button" className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={onClose}>Close</button>
          </div>
          <input className="input" value={form.name} onChange={e => setForm((f:any) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.type} onChange={e => setForm((f:any) => ({ ...f, type: e.target.value }))}>
              <option value="boulder">Boulder</option>
              <option value="top_rope">Top Rope</option>
              <option value="lead">Lead</option>
            </select>
            <input className="input" type="number" min={1} max={10} value={form.grade} onChange={e => setForm((f:any) => ({ ...f, grade: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.section_id} onChange={e => setForm((f:any) => ({ ...f, section_id: e.target.value }))}>
              <option value="">Select section…</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Or section name" value={form.location} onChange={e => setForm((f:any) => ({ ...f, location: e.target.value }))} />
          </div>
          <input className="input" placeholder="Setter (optional)" value={form.setter} onChange={e => setForm((f:any) => ({ ...f, setter: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.color} onChange={e => setForm((f:any) => ({ ...f, color: e.target.value }))}>
              {colorOptions.map((c) => <option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-base-subtext">
              <input type="checkbox" checked={form.dyno} onChange={e => setForm((f:any) => ({ ...f, dyno: e.target.checked }))} /> Dyno
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-base-subtext">
            <input type="checkbox" checked={form.active_status !== false} onChange={e => setForm((f:any) => ({ ...f, active_status: e.target.checked }))} /> Active
          </label>
          <div className="flex items-center justify-end gap-2">
            <button className="btn-primary" disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GymActivityItem({ item, onChanged }: { item: any, onChanged: () => void }) {
  const [bumped, setBumped] = useState<boolean>(!!item.bumped)
  const [count, setCount] = useState<number>(item.bump_count || 0)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [comments, setComments] = useState<any[]>(Array.isArray(item.comments) ? item.comments : [])
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: uidRes } = await supabase.auth.getUser()
      const me = uidRes.user?.id
      if (!me || me === item.user_id) { setFollowing(null); return }
      const { data } = await supabase.from('follows').select('follower_id').eq('follower_id', me).eq('following_id', item.user_id).maybeSingle()
      setFollowing(!!data)
    })()
  }, [item.user_id])

  async function toggleBump() {
    setBusy(true)
    try {
      const { data: uidRes } = await supabase.auth.getUser()
      const me = uidRes.user?.id
      if (!me) throw new Error('Sign in')
      if (!bumped) {
        const { error } = await supabase.from('bumps').insert({ log_id: item.id, user_id: me })
        if (error) throw error
        setBumped(true); setCount(c => c + 1)
      } else {
        const { error } = await supabase.from('bumps').delete().eq('log_id', item.id).eq('user_id', me)
        if (error) throw error
        setBumped(false); setCount(c => Math.max(0, c - 1))
      }
      onChanged()
    } catch (e: any) { alert(e?.message || 'Failed') } finally { setBusy(false) }
  }

  async function sendComment() {
    setBusy(true)
    try {
      const { data: uidRes } = await supabase.auth.getUser()
      const me = uidRes.user?.id
      if (!me) throw new Error('Sign in')
      const { error } = await supabase.from('bumps').upsert({ log_id: item.id, user_id: me, comment }, { onConflict: 'log_id,user_id' })
      if (error) throw error
      if (!bumped) { setBumped(true); setCount(c => c + 1) }
      setShowComment(false); setComment('')
      onChanged()
    } catch (e: any) { alert(e?.message || 'Failed') } finally { setBusy(false) }
  }

  async function toggleFollow() {
    const { data: uidRes } = await supabase.auth.getUser()
    const me = uidRes.user?.id
    if (!me) return alert('Sign in')
    if (following === null) return
    setBusy(true)
    try {
      if (!following) {
        const { error } = await supabase.from('follows').insert({ follower_id: me, following_id: item.user_id })
        if (error) throw error
        setFollowing(true)
      } else {
        const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', item.user_id)
        if (error) throw error
        setFollowing(false)
      }
    } catch (e: any) { alert(e?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-base-subtext">{new Date(item.created_at).toLocaleString()}</div>
          <div className="font-semibold">{item.user_name || 'Climber'} {item.attempt_type} {item.climb_name}</div>
          <div className="text-xs text-base-subtext">{item.type} • Grade {item.grade ?? '-'} • {item.gym_name}</div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button className={`rounded-md px-3 py-1 ${bumped ? 'bg-neon-purple text-white' : 'bg-white/10 hover:bg-white/20'}`} disabled={busy} onClick={toggleBump}>👊 {count}</button>
          {following !== null && (
            <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" disabled={busy} onClick={toggleFollow}>{following ? 'Unfollow' : 'Follow'}</button>
          )}
        </div>
      </div>
      {item.notes && <div className="mt-1 text-sm">{item.notes}</div>}
      {comments.length > 0 && (
        <div className="mt-2 grid gap-2">
          {(showAll ? comments : comments.slice(0, 2)).map((c, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{c.user_name || 'User'}:</span> {c.comment}
            </div>
          ))}
          {comments.length > 2 && (
            <button className="text-xs text-base-subtext text-left" onClick={async () => {
              if (!showAll) {
                // Fetch full list
                const { data } = await supabase
                  .from('bumps')
                  .select('comment, created_at, user:users(name, profile_photo)')
                  .eq('log_id', item.id)
                  .not('comment', 'is', null)
                  .order('created_at', { ascending: false })
                const all = (data || []).map((r: any) => ({
                  user_name: r.user?.name,
                  profile_photo: r.user?.profile_photo,
                  comment: r.comment,
                  created_at: r.created_at
                }))
                setComments(all)
              }
              setShowAll(v => !v)
            }}>{showAll ? 'Show less' : `View more comments (${comments.length})`}</button>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button className="text-base-subtext hover:text-base-text text-sm" onClick={() => setShowComment(v => !v)}>{showComment ? 'Cancel' : 'Comment'}</button>
        {showComment && (
          <>
            <input className="input flex-1" placeholder="Say something nice (optional)" value={comment} onChange={e => setComment(e.target.value)} />
            <button className="btn-primary" disabled={busy || !comment.trim()} onClick={sendComment}>Send</button>
          </>
        )}
      </div>
    </li>
  )
}
