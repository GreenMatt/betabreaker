"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Badge = { id: string, name: string, description: string | null, icon: string | null, criteria: any }
type Challenge = { id: string, title: string, description: string | null, start_date: string, end_date: string, gym_id: string | null }
type Gym = { id: string, name: string }

export default function AdminPage() {
  const [isSiteAdmin, setIsSiteAdmin] = useState(false)
  const [badges, setBadges] = useState<Badge[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])

  const [bForm, setBForm] = useState({ id: '', name: '', description: '', icon: '', criteria: '{}' })
  const [cForm, setCForm] = useState({ id: '', title: '', description: '', start: '', end: '', gym_id: '' })

  const [loading, setLoading] = useState(true)
  const [diag, setDiag] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setDiag(null)
      try {
        const { data: sessionRes, error: sesErr } = await supabase.auth.getSession()
        if (sesErr) setDiag(`auth.getSession error: ${sesErr.message}`)
        if (!sessionRes?.session) {
          setDiag(prev => prev ?? 'No active session. Please sign in.')
        }
        const { data: ok, error: rpcErr } = await supabase.rpc('is_site_admin')
        if (rpcErr) setDiag(prev => prev ?? `is_site_admin error: ${rpcErr.message}`)
        setIsSiteAdmin(!!ok)
        const [{ data: b, error: eb }, { data: c, error: ec }, { data: g, error: eg }] = await Promise.all([
          supabase.from('badges').select('*').order('name'),
          supabase.from('challenges').select('id,title,description,start_date,end_date,gym_id').order('start_date', { ascending: false }),
          supabase.from('gyms').select('id,name').order('name')
        ])
        if (eb) setDiag(prev => prev ?? `badges load error: ${eb.message}`)
        if (ec) setDiag(prev => prev ?? `challenges load error: ${ec.message}`)
        if (eg) setDiag(prev => prev ?? `gyms load error: ${eg.message}`)
        setBadges(b || [])
        setChallenges(c || [])
        setGyms(g || [])
      } catch (e: any) {
        setDiag(e?.message || 'Unexpected error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function saveBadge(e: React.FormEvent) {
    e.preventDefault()
    try {
      const criteria = JSON.parse(bForm.criteria || '{}')
      const { data, error } = await supabase.rpc('admin_upsert_badge', { p_id: bForm.id || null, p_name: bForm.name, p_description: bForm.description || null, p_criteria: criteria, p_icon: bForm.icon || null })
      if (error) throw error
      setBForm({ id: '', name: '', description: '', icon: '', criteria: '{}' })
      const { data: b } = await supabase.from('badges').select('*').order('name')
      setBadges(b || [])
    } catch (e: any) { alert(e?.message || 'Failed') }
  }

  async function deleteBadge(id: string) {
    if (!confirm('Delete badge?')) return
    const { error } = await supabase.rpc('admin_delete_badge', { p_id: id })
    if (error) { alert(error.message); return }
    setBadges(prev => prev.filter(x => x.id !== id))
  }

  async function saveChallenge(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { data, error } = await supabase.rpc('admin_upsert_challenge', {
        p_id: cForm.id || null,
        p_title: cForm.title,
        p_description: cForm.description || null,
        p_start: cForm.start,
        p_end: cForm.end,
        p_criteria: {},
        p_gym_id: cForm.gym_id || null
      })
      if (error) throw error
      setCForm({ id: '', title: '', description: '', start: '', end: '', gym_id: '' })
      const { data: c } = await supabase.from('challenges').select('id,title,description,start_date,end_date,gym_id').order('start_date', { ascending: false })
      setChallenges(c || [])
    } catch (e: any) { alert(e?.message || 'Failed') }
  }

  async function deleteChallenge(id: string) {
    if (!confirm('Delete challenge?')) return
    const { error } = await supabase.rpc('admin_delete_challenge', { p_id: id })
    if (error) { alert(error.message); return }
    setChallenges(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Admin Dashboard</h1>
      {!isSiteAdmin && (
        <div className="text-sm text-red-500">Note: You are not a site admin. You can still create gym-scoped challenges if you are a gym admin. Ask an existing site admin to grant you access.</div>
      )}

      <div className="card grid gap-3">
        <h2 className="font-semibold">Badges</h2>
        <form onSubmit={saveBadge} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Name" value={bForm.name} onChange={e => setBForm(f => ({ ...f, name: e.target.value }))} required />
            <input className="input" placeholder="Icon URL (optional)" value={bForm.icon} onChange={e => setBForm(f => ({ ...f, icon: e.target.value }))} />
          </div>
          <input className="input" placeholder="Description" value={bForm.description} onChange={e => setBForm(f => ({ ...f, description: e.target.value }))} />
          <textarea className="input" placeholder='Criteria JSON, e.g. {"type":"first_send"}' value={bForm.criteria} onChange={e => setBForm(f => ({ ...f, criteria: e.target.value }))} />
          <div className="flex items-center gap-2 justify-end">
            <button className="btn-primary">{bForm.id ? 'Update' : 'Create'} Badge</button>
          </div>
        </form>
        <ul className="divide-y divide-black/10">
          {badges.map(b => (
            <li key={b.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{b.name}</div>
                {b.description && <div className="text-xs text-base-subtext">{b.description}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1 text-sm" onClick={() => setBForm({ id: b.id, name: b.name, description: b.description || '', icon: b.icon || '', criteria: JSON.stringify(b.criteria || {}) })}>Edit</button>
                <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-3 py-1 text-sm" onClick={() => deleteBadge(b.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card grid gap-3">
        <h2 className="font-semibold">Challenges</h2>
        <form onSubmit={saveChallenge} className="grid gap-2">
          <input className="input" placeholder="Title" value={cForm.title} onChange={e => setCForm(f => ({ ...f, title: e.target.value }))} required />
          <input className="input" placeholder="Description" value={cForm.description} onChange={e => setCForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="date" value={cForm.start} onChange={e => setCForm(f => ({ ...f, start: e.target.value }))} required />
            <input className="input" type="date" value={cForm.end} onChange={e => setCForm(f => ({ ...f, end: e.target.value }))} required />
          </div>
          <select className="input" value={cForm.gym_id} onChange={e => setCForm(f => ({ ...f, gym_id: e.target.value }))}>
            <option value="">Site-wide (site admin only)</option>
            {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="flex items-center gap-2 justify-end">
            <button className="btn-primary">{cForm.id ? 'Update' : 'Create'} Challenge</button>
          </div>
        </form>
        <ul className="divide-y divide-black/10">
          {challenges.map(c => (
            <li key={c.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-base-subtext">{new Date(c.start_date).toLocaleDateString()} → {new Date(c.end_date).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1 text-sm" onClick={() => setCForm({ id: c.id, title: c.title, description: c.description || '', start: c.start_date?.slice(0,10) || '', end: c.end_date?.slice(0,10) || '', gym_id: c.gym_id || '' })}>Edit</button>
                <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-3 py-1 text-sm" onClick={() => deleteChallenge(c.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
