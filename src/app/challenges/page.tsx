"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Challenge = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
}

export default function ChallengesPage() {
  const [rows, setRows] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('challenges').select('id,title,description,start_date,end_date').order('start_date', { ascending: false })
      if (!mounted) return
      if (error) setError(error.message)
      else setRows(data || [])
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Challenges</h1>
      <div className="card">
        <p className="text-base-subtext">Monthly and seasonal objectives with progress tracking and rankings.</p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Active & Upcoming</h2>
        {loading && <div className="text-base-subtext">Loading challenges…</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {!loading && !error && rows.length === 0 && <div className="text-base-subtext">No challenges found.</div>}
        <ul className="divide-y divide-white/5">
          {rows.map(c => (
            <li key={c.id} className="py-2">
              <div className="font-medium">{c.title}</div>
              {c.description && <div className="text-xs text-base-subtext">{c.description}</div>}
              <div className="text-xs text-base-subtext">{new Date(c.start_date).toLocaleDateString()} → {new Date(c.end_date).toLocaleDateString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
