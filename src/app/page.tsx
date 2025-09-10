"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Page() {
  const router = useRouter()
  const [stats, setStats] = useState<{ climbs: number, highest: number, badges: number, fas: number } | null>(null)
  const [allBadges, setAllBadges] = useState<Array<{ id: string, name: string, icon: string | null, description: string | null }>>([])

  useEffect(() => {
    let unsub: (() => void) | undefined
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
      else { loadStats(); loadAllBadges() }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) router.replace('/login')
      else { loadStats(); loadAllBadges() }
    })
    unsub = () => sub.subscription.unsubscribe()
    return () => { unsub?.() }
  }, [router])

  async function loadStats() {
    console.log('Loading stats...')
    const rpc = await supabase.rpc('get_user_stats')
    console.log('Stats RPC result:', rpc)
    if (!rpc.error && rpc.data) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
      if (row) {
        setStats({ climbs: row.climb_count ?? 0, highest: row.highest_grade ?? 0, badges: row.badge_count ?? 0, fas: row.fa_count ?? 0 })
        return
      }
    } else if (rpc.error) {
      console.error('Stats loading error:', rpc.error)
    }
    // Fallback if RPC not installed yet
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (!uid) return
    const logs = await supabase.from('climb_logs').select('climb:climbs(grade)').eq('user_id', uid)
    const climbs = logs.data || []
    const highest = climbs.reduce((m, r: any) => Math.max(m, r.climb?.grade ?? 0), 0)
    const { count: c1 } = await supabase.from('climb_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid)
    const { count: c2 } = await supabase.from('user_badges').select('user_id', { count: 'exact', head: true }).eq('user_id', uid)
    // Fallback has no FA info; set to 0
    setStats({ climbs: c1 ?? climbs.length, highest, badges: c2 ?? 0, fas: 0 })
  }

  function resolveIconUrl(icon: string | null): string {
    if (!icon) return '/icons/betabreaker_header.png'
    if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
    if (icon.startsWith('/')) return icon
    const normalized = icon.replace(/^\/?icons\//, '')
    return `/icons/${normalized}`
  }

  async function loadAllBadges() {
    console.log('Loading badges...')
    const { data, error } = await supabase.from('badges').select('id,name,icon,description').order('name')
    console.log('Badges result:', { data, error })
    if (!error) setAllBadges(data || [])
    else console.error('Badges loading error:', error)
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-base-subtext">Log your climbs, track progress, and challenge friends.</p>
        <div className="mt-4 flex gap-3">
          <Link className="btn-primary" href="/log">Quick Log</Link>
          <Link className="btn-primary" href="/gym">Browse Gyms</Link>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Personal Stats</h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-3xl font-bold">{stats?.climbs ?? 0}</div>
            <div className="text-xs text-base-subtext">Climbs</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats?.highest ?? 0}</div>
            <div className="text-xs text-base-subtext">Highest Grade</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats?.badges ?? 0}</div>
            <div className="text-xs text-base-subtext">Badges</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats?.fas ?? 0}</div>
            <div className="text-xs text-base-subtext">FAs</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Recent Activity</h2>
        <p className="text-base-subtext">Visit the Feed to see your latest logs and friends’ activity.</p>
        <div className="mt-3">
          <Link className="btn-primary" href="/feed">Open Feed</Link>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">All Badges</h2>
        {allBadges.length === 0 && (
          <p className="text-base-subtext">No badges defined yet.</p>
        )}
        {allBadges.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {allBadges.map(b => (
              <div key={b.id} className="flex flex-col items-center text-center gap-1">
                <img
                  src={resolveIconUrl(b.icon)}
                  alt={b.name}
                  className="h-20 w-20 rounded object-contain bg-white/10"
                  loading="lazy"
                />
                <div className="text-sm font-medium">{b.name}</div>
                {b.description && (
                  <div className="text-xs text-base-subtext">{b.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
