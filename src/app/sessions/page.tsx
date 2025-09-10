"use client"
import { useEffect, useMemo, useState } from 'react'
import { supabaseWithRefresh as supabase } from '@/lib/supabaseWrapper'
import { useAuth } from '@/lib/authContext'

type Session = {
  id: string
  date: string
  duration_mins: number | null
  activity_type: 'Climb' | 'Board' | 'Hang' | 'Strength' | 'Cardio' | 'Yoga' | 'Boulder' | 'Top Rope' | 'Lead' | 'Strength Training' | 'Other'
  notes: string | null
}

const ACTIVITIES: Array<{ key: Session['activity_type']; label: string; color: string; bg: string }> = [
  { key: 'Climb', label: 'Climb', color: 'text-sky-400', bg: 'bg-sky-500/20' },
  { key: 'Board', label: 'Board', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  { key: 'Hang', label: 'Hang', color: 'text-violet-400', bg: 'bg-violet-500/20' },
  { key: 'Strength', label: 'Strength', color: 'text-red-400', bg: 'bg-red-500/20' },
  { key: 'Cardio', label: 'Cardio', color: 'text-rose-500', bg: 'bg-rose-500/20' },
  { key: 'Yoga', label: 'Yoga', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
]

type NewType = 'Climb' | 'Board' | 'Hang' | 'Strength' | 'Cardio' | 'Yoga'

function normalize(type: Session['activity_type']): NewType {
  switch (type) {
    case 'Boulder':
    case 'Top Rope':
    case 'Lead':
      return 'Climb'
    case 'Strength Training':
      return 'Strength'
    case 'Other':
      return 'Climb'
    default:
      return type as NewType
  }
}

function Icon({ type, size = 'md' }: { type: NewType, size?: 'sm' | 'md' | 'lg' }) {
  const cfg = ACTIVITIES.find(a => a.key === type)!
  const wrap = size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-6 w-6' : 'h-5 w-5'
  const inner = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <span className={`inline-flex items-center justify-center rounded-full ${cfg.bg} ${wrap}`}>
      {type === 'Climb' && (
        <svg viewBox="0 0 24 24" className={`${inner} ${cfg.color}`} fill="currentColor">
          <path d="M12 3L2 21h20L12 3z" />
        </svg>
      )}
      {type === 'Board' && (
        <svg viewBox="0 0 24 24" className={`${inner} ${cfg.color}`} fill="currentColor">
          <rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14h16M9 5v14M15 5v14" stroke="currentColor" strokeWidth="0.5" fill="none" />
        </svg>
      )}
      {type === 'Hang' && (
        <svg viewBox="0 0 24 24" className={`${inner} ${cfg.color}`} fill="currentColor">
          <rect x="4" y="6" width="16" height="2"/><rect x="6" y="8" width="2" height="6"/><rect x="16" y="8" width="2" height="6"/>
        </svg>
      )}
      {type === 'Strength' && (
        <svg viewBox="0 0 24 24" className={`${inner} ${cfg.color}`} fill="currentColor">
          <rect x="4" y="10" width="3" height="4"/><rect x="17" y="10" width="3" height="4"/><rect x="8" y="11" width="8" height="2"/>
        </svg>
      )}
      {type === 'Cardio' && (
        <svg viewBox="0 0 24 24" className={`${inner} ${cfg.color}`} fill="currentColor">
          <path d="M12 21s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.65-7 10-7 10z" />
        </svg>
      )}
      {type === 'Yoga' && (
        <svg viewBox="0 0 24 24" className={`${inner} ${cfg.color}`} fill="currentColor">
          <circle cx="12" cy="6" r="2"/><path d="M12 8c-2 3-6 3-6 6 0 2 2 3 6 3s6-1 6-3c0-3-4-3-6-6z" />
        </svg>
      )}
    </span>
  )
}

export default function SessionsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [activity, setActivity] = useState<Session['activity_type']>('Climb')
  const [duration, setDuration] = useState<string>('60')
  const [notes, setNotes] = useState('')

  const today = new Date()
  const [viewYear, setViewYear] = useState<number>(today.getFullYear())
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()) // 0..11
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startDay = firstOfMonth.getDay() // 0..6 (Sun..Sat)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Session>>({})

  const grouped = useMemo(() => {
    const m = new Map<string, Session[]>()
    for (const s of items) {
      const d = new Date(s.date)
      const key = d.toISOString().slice(0,10)
      const arr = m.get(key) || []
      arr.push(s)
      m.set(key, arr)
    }
    return m
  }, [items])

  useEffect(() => {
    if (!user) { setItems([]); return }
    ;(async () => {
      setLoading(true)
      try {
        const start = new Date(viewYear, viewMonth, 1).toISOString()
        const end = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
        const { data, error } = await supabase
          .from('training_sessions')
          .select('id, date, duration_mins, activity_type, notes')
          .eq('user_id', user.id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true })
        if (error) throw error
        setItems((data || []) as any)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id, viewYear, viewMonth])

  async function addSession() {
    if (!user) return
    const dur = Math.max(0, parseInt(duration || '0', 10))
    const when = new Date(date)
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .insert({ user_id: user.id, date: when.toISOString(), duration_mins: dur, activity_type: activity, notes })
        .select('id, date, duration_mins, activity_type, notes')
        .single()
      if (error) throw error
      setItems(prev => [...prev, data as any])
      // reset note
      setNotes('')
    } catch (e: any) {
      alert(e?.message || 'Failed to add session')
    }
  }

  function prevMonth() {
    setViewMonth(m => {
      const nm = m - 1
      if (nm < 0) { setViewYear(y => y - 1); return 11 }
      return nm
    })
  }
  function nextMonth() {
    setViewMonth(m => {
      const nm = m + 1
      if (nm > 11) { setViewYear(y => y + 1); return 0 }
      return nm
    })
  }

  const dayCells: Array<JSX.Element> = []
  for (let i = 0; i < startDay; i++) {
    dayCells.push(<div key={`blank-${i}`} className="p-2 h-16" />)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const keyDate = new Date(viewYear, viewMonth, d)
    const key = keyDate.toISOString().slice(0,10)
    const list = grouped.get(key) || []
    dayCells.push(
      <button key={`d-${d}`} className="p-2 h-16 border border-white/5 rounded text-left hover:bg-white/5" onClick={() => setDate(key)}>
        <div className="text-xs text-base-subtext">{d}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {list.slice(0,4).map((s, idx) => (
            <Icon key={s.id + idx} type={normalize(s.activity_type)} size="md" />
          ))}
          {list.length > 4 && (
            <span className="text-[10px] text-base-subtext">+{list.length - 4}</span>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Training Log</h1>
      <div className="card">
        <div className="mb-2 text-sm text-base-subtext flex items-center justify-between">
          <button className="btn-secondary" onClick={prevMonth}>&larr; Prev</button>
          <div>{new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button className="btn-secondary" onClick={nextMonth}>Next &rarr;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-base-subtext mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dayCells}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Add Session</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Date
            <input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="text-sm">Duration (mins)
            <input type="number" min={0} className="input w-full" value={duration} onChange={e => setDuration(e.target.value)} />
          </label>
          <label className="text-sm">Activity
            <select className="input w-full" value={activity} onChange={e => setActivity(e.target.value as any)}>
              {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Notes
            <input className="input w-full" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="mt-3">
          <button className="btn-primary" onClick={addSession} disabled={loading}>Save Session</button>
        </div>
        <div className="mt-3 text-xs text-base-subtext">Icons:
          <div className="mt-1 flex flex-wrap gap-3 items-center">
            {ACTIVITIES.map(a => (
              <div key={a.key} className="flex items-center gap-1">
                <Icon type={a.key as any} size="md" />
                <span className="text-xs">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">This Month</h2>
        {items.length === 0 && <div className="text-base-subtext text-sm">No sessions yet.</div>}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded hover:bg-white/5">
                <Icon type={normalize(s.activity_type)} size="lg" />
                {editingId === s.id ? (
                  <div className="flex-1 grid gap-2 sm:grid-cols-4">
                    <input type="date" className="input" value={(editDraft.date as string) || s.date.slice(0,10)} onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))} />
                    <select className="input" value={(editDraft.activity_type as Session['activity_type']) || s.activity_type} onChange={e => setEditDraft(d => ({ ...d, activity_type: e.target.value as any }))}>
                      {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                    <input type="number" min={0} className="input" value={String((editDraft.duration_mins ?? s.duration_mins) ?? 0)} onChange={e => setEditDraft(d => ({ ...d, duration_mins: parseInt(e.target.value || '0', 10) }))} />
                    <input className="input" placeholder="Notes" value={(editDraft.notes as string) ?? (s.notes || '')} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} />
                  </div>
                ) : (
                  <div className="flex-1 text-sm">
                    <span className="text-base-subtext mr-2">{new Date(s.date).toLocaleDateString()}</span>
                    <span className="font-medium mr-2">{normalize(s.activity_type)}</span>
                    <span className="mr-2">{s.duration_mins || 0}m</span>
                    {s.notes && <span className="text-base-subtext">{s.notes}</span>}
                  </div>
                )}
                {editingId === s.id ? (
                  <div className="flex items-center gap-2">
                    <button className="btn-primary" onClick={async () => {
                      try {
                        const payload: any = {
                          date: new Date(((editDraft.date as string) || s.date)).toISOString(),
                          activity_type: (editDraft.activity_type as Session['activity_type']) || s.activity_type,
                          duration_mins: (typeof editDraft.duration_mins === 'number' ? editDraft.duration_mins : s.duration_mins) || 0,
                          notes: (editDraft.notes as string) ?? s.notes
                        }
                        const { error, data } = await supabase
                          .from('training_sessions')
                          .update(payload)
                          .eq('id', s.id)
                          .select('id, date, duration_mins, activity_type, notes')
                          .single()
                        if (error) throw error
                        setItems(prev => prev.map(x => x.id === s.id ? (data as any) : x))
                        setEditingId(null)
                        setEditDraft({})
                      } catch (e: any) {
                        alert(e?.message || 'Failed to save')
                      }
                    }}>Save</button>
                    <button className="btn-secondary" onClick={() => { setEditingId(null); setEditDraft({}) }}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary" onClick={() => { setEditingId(s.id); setEditDraft({}) }}>Edit</button>
                    <button className="btn-secondary" onClick={async () => {
                      if (!confirm('Delete this session?')) return
                      const { error } = await supabase.from('training_sessions').delete().eq('id', s.id)
                      if (error) { alert(error.message); return }
                      setItems(prev => prev.filter(x => x.id !== s.id))
                    }}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Stats items={items} />
    </div>
  )
}

function Stats({ items }: { items: Session[] }) {
  const totals = useMemo(() => {
    const counts = new Map<NewType, { count: number, minutes: number }>()
    for (const a of ['Climb','Board','Hang','Strength','Cardio','Yoga'] as NewType[]) {
      counts.set(a, { count: 0, minutes: 0 })
    }
    for (const s of items) {
      const key = normalize(s.activity_type)
      const entry = counts.get(key)!
      entry.count += 1
      entry.minutes += s.duration_mins || 0
    }
    return counts
  }, [items])

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">This Month Stats</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(['Climb','Board','Hang','Strength','Cardio','Yoga'] as NewType[]).map(k => {
          const v = totals.get(k)!
          return (
            <div key={k} className="flex items-center gap-2">
              <Icon type={k as any} size="md" />
              <div className="text-sm"><span className="font-medium mr-2">{k}</span>{v.count}x ? {v.minutes}m</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}





