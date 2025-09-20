"use client"
import { useEffect, useMemo, useState } from 'react'
import { useFocusTick } from '@/lib/useFocusTick'
import { supabase } from '@/lib/supabaseClient'
import { useBadgeAwardContext } from '@/contexts/BadgeAwardContext'
import { triggerBadgeCheck } from '@/lib/badgeChecker'

type Gym = { id: string; name: string }
type Climb = { id: string; name: string; gym_id: string }

export default function QuickLogPage() {
  const focusTick = useFocusTick(250)
  const { awardMultipleBadges } = useBadgeAwardContext()
  const [gyms, setGyms] = useState<Gym[]>([])
  const [climbs, setClimbs] = useState<Climb[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    gym_id: '',
    climb_id: '',
    attempt_type: 'flashed' as 'flashed' | 'sent' | 'projected',
    attempts: 1,
    personal_rating: 3 as 1|2|3|4|5,
    community_grade: 5,
    notes: ''
  })
  // Keep a text input buffer for attempts so users can clear/edit on mobile
  const [attemptsInput, setAttemptsInput] = useState<string>('1')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.from('gyms').select('id,name').order('name')
      if (mounted) setGyms(data || [])
    })()
    return () => { mounted = false }
  }, [focusTick])

  useEffect(() => {
    let mounted = true
    if (!form.gym_id) { setClimbs([]); setForm(f => ({ ...f, climb_id: '' })); return }
    ;(async () => {
      const { data } = await supabase.from('climbs').select('id,name,gym_id').eq('gym_id', form.gym_id).order('name')
      if (mounted) setClimbs(data || [])
    })()
    return () => { mounted = false }
  }, [form.gym_id])

  // Keep attempts input string in sync when attempt_type toggles or value changes
  useEffect(() => {
    setAttemptsInput(String(form.attempts ?? 1))
  }, [form.attempts])

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setStatus(null)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) throw new Error('Not signed in')
      if (!form.climb_id) throw new Error('Please select a climb')

      // Insert into climb_logs
      const logPayload: any = {
        user_id: user.id,
        climb_id: form.climb_id,
        attempt_type: form.attempt_type,
        personal_rating: form.personal_rating,
        notes: form.notes || null,
        attempts: form.attempt_type === 'sent' ? form.attempts : null
      }
      const { error: logErr } = await supabase.from('climb_logs').insert(logPayload)
      if (logErr) throw logErr

      // Upsert community grade (1-10 scale)
      if (form.community_grade) {
        const { error: comErr } = await supabase
          .from('community_ratings')
          .upsert({ user_id: user.id, climb_id: form.climb_id, rating: form.community_grade }, { onConflict: 'user_id,climb_id' })
        if (comErr) throw comErr
      }

      // Check for new badges after successful climb log
      await triggerBadgeCheck(user.id, awardMultipleBadges)

      setStatus('Logged!')
      setForm({ gym_id: form.gym_id, climb_id: '', attempt_type: 'flashed', attempts: 1, personal_rating: 3, community_grade: 5, notes: '' })
    } catch (e: any) {
      setError(e?.message || 'Failed to log climb')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Quick Log</h1>
      <form onSubmit={submit} className="card grid gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select className="input" value={form.gym_id} onChange={e => update('gym_id', e.target.value)}>
            <option value="">Select gym…</option>
            {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" value={form.climb_id} onChange={e => update('climb_id', e.target.value)} disabled={!form.gym_id}>
            <option value="">{form.gym_id ? 'Select climb…' : 'Select gym first'}</option>
            {climbs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm text-base-subtext">Attempt</legend>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="attempt" checked={form.attempt_type==='flashed'} onChange={() => update('attempt_type','flashed')} /> Flashed</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="attempt" checked={form.attempt_type==='sent'} onChange={() => update('attempt_type','sent')} /> Sent</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="attempt" checked={form.attempt_type==='projected'} onChange={() => update('attempt_type','projected')} /> Projected</label>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="grid gap-1">
            <label className="text-sm text-base-subtext">Attempts</label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                className="px-3 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50"
                onClick={() => update('attempts', Math.max(1, (form.attempts || 1) - 1) as any)}
                disabled={form.attempt_type !== 'sent' || (form.attempts || 1) <= 1}
                aria-label="Decrease attempts"
              >
                −
              </button>
              <input
                className="input w-24 text-center"
                inputMode="numeric"
                pattern="[0-9]*"
                value={attemptsInput}
                onChange={e => {
                  const v = e.target.value
                  // Accept empty while editing; restrict to digits
                  if (v === '' || /^\d+$/.test(v)) setAttemptsInput(v)
                }}
                onBlur={() => {
                  const n = parseInt(attemptsInput || '1', 10)
                  const val = isNaN(n) ? 1 : Math.max(1, n)
                  setAttemptsInput(String(val))
                  update('attempts', val as any)
                }}
                disabled={form.attempt_type !== 'sent'}
              />
              <button
                type="button"
                className="px-3 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50"
                onClick={() => update('attempts', ((form.attempts || 1) + 1) as any)}
                disabled={form.attempt_type !== 'sent'}
                aria-label="Increase attempts"
              >
                +
              </button>
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-base-subtext">Community Grade</label>
            <select className="input" value={form.community_grade} onChange={e => update('community_grade', Number(e.target.value) as any)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-base-subtext">Your Rating</label>
          <StarRating value={form.personal_rating} onChange={v => update('personal_rating', v as any)} />
        </div>

        <textarea className="input" placeholder="Notes (optional)" value={form.notes} onChange={e => update('notes', e.target.value)} />
        <button className="btn-primary" disabled={submitting || !form.gym_id || !form.climb_id}>{submitting ? 'Saving…' : 'Log Climb'}</button>
        {status && <p className="text-sm text-neon-purple">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
      <p className="text-xs text-base-subtext">Logs save to your account; community grade updates the shared rating.</p>
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
