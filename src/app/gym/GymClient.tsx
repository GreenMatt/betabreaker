"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Gym = {
  id: string
  name: string
  location: string | null
  profile_photo: string | null
}

export default function GymClient({ initialGyms }: { initialGyms: Gym[] }) {
  const [gyms, setGyms] = useState<Gym[]>(initialGyms)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialGyms && initialGyms.length > 0) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('gyms').select('id,name,location,profile_photo').order('created_at', { ascending: true })
      if (!mounted) return
      if (error) setError(error.message)
      else setGyms(data || [])
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [initialGyms])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Gyms</h1>
      <div className="card">
        <p className="text-base-subtext">Admins can create and manage gyms. Browse active climbs by gym.</p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">All Gyms</h2>
        {loading && <div className="text-base-subtext">Loading…</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {!loading && !error && gyms.length === 0 && (
          <div className="text-base-subtext">No gyms yet.</div>
        )}
        <ul className="divide-y divide-white/5">
          {gyms.map(g => (
            <li key={g.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Profile Photo */}
                {g.profile_photo ? (
                  <img
                    src={`data:image/*;base64,${g.profile_photo}`}
                    alt={`${g.name} profile`}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                    <span className="text-lg text-base-subtext">🏔️</span>
                  </div>
                )}

                {/* Gym Info */}
                <div>
                  <div className="font-medium">{g.name}</div>
                  {g.location && <div className="text-xs text-base-subtext">{g.location}</div>}
                </div>
              </div>
              <Link className="text-sm text-neon-purple" href={`/gym/${g.id}`}>Open</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

