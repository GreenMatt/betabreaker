"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Gym = {
  id: string
  name: string
  location: string | null
}

export default function GymPage() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('gyms').select('id,name,location').order('created_at', { ascending: true })
      if (!mounted) return
      if (error) setError(error.message)
      else setGyms(data || [])
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Gyms</h1>
      <div className="card">
        <p className="text-base-subtext">Admins can create and manage gyms. Browse active climbs by gym.</p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">All Gyms</h2>
        {loading && <div className="text-base-subtext">Loading gyms…</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {!loading && !error && gyms.length === 0 && (
          <div className="text-base-subtext">No gyms yet.</div>
        )}
        <ul className="divide-y divide-white/5">
          {gyms.map(g => (
            <li key={g.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{g.name}</div>
                {g.location && <div className="text-xs text-base-subtext">{g.location}</div>}
              </div>
              <Link className="text-sm text-neon-purple" href={`/gym/${g.id}`}>Open</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
