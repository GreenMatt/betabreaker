"use client"
import { useState, useMemo } from 'react'

// Lazy-load Supabase on the client to avoid Edge runtime pulling Node builtins
const getSupabase = async () => (await import('@/lib/supabaseClient')).supabase

// Helper to get YYYY-MM-DD in local time (no timezone conversion)
function toLocalYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

interface SessionsClientProps {
  initialItems: Session[]
  userId: string
  initialYear: number
  initialMonth: number
}

export default function SessionsClient({
  initialItems,
  userId,
  initialYear,
  initialMonth
}: SessionsClientProps) {
  const [items, setItems] = useState<Session[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState<string>(() => toLocalYMD(new Date()))
  const [activity, setActivity] = useState<Session['activity_type']>('Climb')
  const [duration, setDuration] = useState<string>('60')
  const [notes, setNotes] = useState('')

  const today = new Date()
  const [viewYear, setViewYear] = useState<number>(initialYear)
  const [viewMonth, setViewMonth] = useState<number>(initialMonth)
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startDay = firstOfMonth.getDay() // 0..6 (Sun..Sat)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Session>>({})
  const [sessionsPage, setSessionsPage] = useState(0)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsHasMore, setSessionsHasMore] = useState(true)

  const grouped = useMemo(() => {
    const m = new Map<string, Session[]>()
    for (const s of items) {
      // Use the date string directly to avoid timezone issues
      const key = s.date.slice(0, 10)
      const arr = m.get(key) || []
      arr.push(s)
      m.set(key, arr)
    }
    return m
  }, [items])

  // Handle month/year changes with page refresh
  function handleMonthYearChange(newYear: number, newMonth: number) {
    const url = new URL(window.location.href)
    url.searchParams.set('year', newYear.toString())
    url.searchParams.set('month', newMonth.toString())
    window.location.href = url.toString()
  }

  async function addSession() {
    if (!userId) return
    const dur = Math.max(0, parseInt(duration || '0', 10))
    // Insert plain YYYY-MM-DD string (no timezone conversion)
    try {
      const supabase = await getSupabase()
      const { data, error } = await supabase
        .from('training_sessions')
        .insert({ user_id: userId, date: date, duration_mins: dur, activity_type: activity, notes })
        .select('id, date, duration_mins, activity_type, notes')
        .single()
      if (error) throw error
      setItems(prev => [data as any, ...prev])
      // reset note
      setNotes('')
    } catch (e: any) {
      alert(e?.message || 'Failed to add session')
    }
  }

  async function loadMoreSessions() {
    setSessionsLoading(true)
    try {
      const supabase = await getSupabase()
      const monthStartYMD = toLocalYMD(new Date(viewYear, viewMonth, 1))
      const monthEndYMD = toLocalYMD(new Date(viewYear, viewMonth + 1, 0))
      const pageSize = 5
      const offset = (sessionsPage + 1) * pageSize
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, date, duration_mins, activity_type, notes')
        .eq('user_id', userId)
        .gte('date', monthStartYMD)
        .lte('date', monthEndYMD)
        .order('date', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (!error && data) {
        setItems(prev => [...prev, ...data as any[]])
        setSessionsPage(prev => prev + 1)
        setSessionsHasMore(data.length === pageSize)
      }
    } finally {
      setSessionsLoading(false)
    }
  }

  function prevMonth() {
    const newMonth = viewMonth - 1
    if (newMonth < 0) {
      handleMonthYearChange(viewYear - 1, 11)
    } else {
      handleMonthYearChange(viewYear, newMonth)
    }
  }

  function nextMonth() {
    const newMonth = viewMonth + 1
    if (newMonth > 11) {
      handleMonthYearChange(viewYear + 1, 0)
    } else {
      handleMonthYearChange(viewYear, newMonth)
    }
  }

  const dayCells: Array<JSX.Element> = []
  for (let i = 0; i < startDay; i++) {
    dayCells.push(<div key={`blank-${i}`} className="p-3 h-20" />)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const keyDate = new Date(viewYear, viewMonth, d)
    const key = toLocalYMD(keyDate)
    const list = grouped.get(key) || []
    const isToday = key === toLocalYMD(new Date())
    const hasActivity = list.length > 0

    dayCells.push(
      <button
        key={`d-${d}`}
        className={`
          relative p-3 h-20 border rounded-lg transition-all duration-200 flex flex-col
          ${isToday
            ? 'border-neon-purple/50 bg-neon-purple/5 shadow-lg shadow-neon-purple/10'
            : hasActivity
              ? 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          }
        `}
        onClick={() => setDate(key)}
      >
        {/* Date number - always at top */}
        <div className={`
          text-sm font-medium leading-none
          ${isToday
            ? 'text-neon-purple'
            : hasActivity
              ? 'text-gray-300'
              : 'text-gray-400'
          }
        `}>
          {d}
        </div>

        {/* Activity indicators - positioned at bottom */}
        <div className="mt-auto flex items-center justify-center pb-1">
          {hasActivity && (
            <div className="flex gap-1">
              {list.slice(0,4).map((s, idx) => {
                const activityType = normalize(s.activity_type)
                let dotColor = 'bg-gray-400'

                switch(activityType) {
                  case 'Climb': dotColor = 'bg-sky-500'; break;
                  case 'Board': dotColor = 'bg-amber-500'; break;
                  case 'Hang': dotColor = 'bg-violet-500'; break;
                  case 'Strength': dotColor = 'bg-red-500'; break;
                  case 'Cardio': dotColor = 'bg-rose-500'; break;
                  case 'Yoga': dotColor = 'bg-emerald-500'; break;
                }

                return (
                  <div
                    key={s.id + idx}
                    className={`w-2 h-2 rounded-full ${dotColor}`}
                  />
                )
              })}
              {list.length > 4 && (
                <div className="w-2 h-2 rounded-full bg-white/60 ml-0.5" />
              )}
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Training Log</h1>

      <div className="card">
        <h2 className="font-semibold mb-3">Add Session</h2>
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="text-sm block">
                <span className="block mb-1 text-base-subtext">Date</span>
                <div className="relative rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-neon-purple/50 focus-within:border-neon-purple/50">
                  <input
                    type="date"
                    className="w-full min-w-0 text-base sm:text-sm bg-transparent px-3 py-2 text-gray-800 focus:outline-none"
                    style={{
                      colorScheme: 'light'
                    }}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
              </label>
            </div>
            <label className="text-sm block">
              <span className="block mb-1 text-base-subtext">Duration (mins)</span>
              <input type="number" min={0} className="input w-full min-w-0" value={duration} onChange={e => setDuration(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <label className="text-sm block">
              <span className="block mb-1 text-base-subtext">Activity</span>
              <select className="input w-full min-w-0" value={activity} onChange={e => setActivity(e.target.value as any)}>
                {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </label>
            <label className="text-sm block">
              <span className="block mb-1 text-base-subtext">Notes</span>
              <input className="input w-full min-w-0" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary w-full sm:w-auto" onClick={addSession} disabled={loading}>Save Session</button>
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
        <div className="mb-4 flex items-center justify-between">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
            onClick={prevMonth}
          >
            <span className="text-lg">←</span> Prev
          </button>
          <h2 className="text-lg font-semibold text-center">
            {new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
            onClick={nextMonth}
          >
            Next <span className="text-lg">→</span>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-base-subtext mb-3">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {dayCells}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3 text-gray-800">This Month</h2>
        {items.length === 0 && (
          <div className="text-center py-6 text-base-subtext">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-sm">No sessions yet this month</div>
          </div>
        )}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map(s => {
              const activityType = normalize(s.activity_type)
              const cfg = ACTIVITIES.find(a => a.key === activityType)!
              const sessionDate = new Date(s.date)
              const isToday = s.date.slice(0,10) === toLocalYMD(new Date())

              return (
                <div key={s.id} className={`
                  group relative rounded-lg border transition-all duration-200 p-3
                  ${isToday
                    ? 'border-neon-purple/30 bg-neon-purple/5'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }
                `}>
                  {editingId === s.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div className="relative rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-neon-purple/50 focus-within:border-neon-purple/50">
                          <input
                            type="date"
                            className="w-full min-w-0 text-base sm:text-sm bg-transparent px-3 py-2 text-gray-800 focus:outline-none"
                            style={{
                              colorScheme: 'light'
                            }}
                            value={(editDraft.date as string) || s.date.slice(0,10)}
                            onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
                          />
                        </div>
                        <select className="input text-sm" value={(editDraft.activity_type as Session['activity_type']) || s.activity_type} onChange={e => setEditDraft(d => ({ ...d, activity_type: e.target.value as any }))}>
                          {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                        </select>
                        <input type="number" min={0} placeholder="Duration (mins)" className="input text-sm" value={String((editDraft.duration_mins ?? s.duration_mins) ?? 0)} onChange={e => setEditDraft(d => ({ ...d, duration_mins: parseInt(e.target.value || '0', 10) }))} />
                        <input className="input text-sm" placeholder="Notes" value={(editDraft.notes as string) ?? (s.notes || '')} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors" onClick={() => { setEditingId(null); setEditDraft({}) }}>Cancel</button>
                        <button className="px-3 py-1 bg-neon-purple hover:bg-neon-purple/80 rounded text-xs font-medium transition-colors" onClick={async () => {
                          try {
                            const supabase = await getSupabase()
                            const payload: any = {
                              date: (editDraft.date as string) || s.date.slice(0, 10),
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
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {/* Compact activity icon */}
                      <div className={`flex-shrink-0 rounded-lg p-2 ${cfg.bg}`}>
                        <Icon type={activityType} size="md" />
                      </div>

                      {/* Session info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-800 text-sm">{activityType}</span>
                          {isToday && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-neon-purple/20 text-neon-purple">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-base-subtext">
                          {sessionDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })} • {s.duration_mins || 0} minutes
                        </div>
                        {s.notes && (
                          <div className="text-xs text-gray-400 italic mt-1">"{s.notes}"</div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                          onClick={() => { setEditingId(s.id); setEditDraft({}) }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                          onClick={async () => {
                            if (!confirm('Delete this session?')) return
                            const supabase = await getSupabase()
                            const { error } = await supabase.from('training_sessions').delete().eq('id', s.id)
                            if (error) { alert(error.message); return }
                            setItems(prev => prev.filter(x => x.id !== s.id))
                          }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {sessionsHasMore && (
              <div className="flex justify-center mt-4">
                <button
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  disabled={sessionsLoading}
                  onClick={loadMoreSessions}
                >
                  {sessionsLoading ? 'Loading more sessions…' : 'Load more sessions'}
                </button>
              </div>
            )}
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

  const totalSessions = items.length
  const totalMinutes = items.reduce((sum, s) => sum + (s.duration_mins || 0), 0)
  const maxCount = Math.max(...Array.from(totals.values()).map(v => v.count), 1)

  return (
    <div className="card">
      <h2 className="font-semibold mb-4">This Month Stats</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-neon-purple/10 to-neon-purple/5 rounded-lg p-4 border border-neon-purple/20">
          <div className="text-2xl font-bold text-neon-purple">{totalSessions}</div>
          <div className="text-sm text-base-subtext">Total Sessions</div>
        </div>
        <div className="bg-gradient-to-br from-sky-500/10 to-sky-500/5 rounded-lg p-4 border border-sky-500/20">
          <div className="text-2xl font-bold text-sky-400">{Math.round(totalMinutes / 60 * 10) / 10}h</div>
          <div className="text-sm text-base-subtext">Training Time</div>
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="space-y-3">
        {(['Climb','Board','Hang','Strength','Cardio','Yoga'] as NewType[]).map(k => {
          const v = totals.get(k)!
          const cfg = ACTIVITIES.find(a => a.key === k)!
          const percentage = maxCount > 0 ? (v.count / maxCount) * 100 : 0
          const hours = Math.round(v.minutes / 60 * 10) / 10

          if (v.count === 0) return null

          return (
            <div key={k} className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Icon type={k as any} size="md" />
                  <span className="font-medium text-sm">{k}</span>
                </div>
                <div className="text-sm text-base-subtext">
                  {v.count} session{v.count !== 1 ? 's' : ''} • {hours}h
                </div>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${cfg.bg} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {totalSessions === 0 && (
        <div className="text-center py-8 text-base-subtext">
          <div className="text-4xl mb-2">📊</div>
          <div>No training sessions this month yet.</div>
          <div className="text-sm">Add your first session to see stats!</div>
        </div>
      )}
    </div>
  )
}