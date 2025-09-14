// app/page.tsx
// Server-rendered home to avoid client auth bootstrap gaps

import Link from 'next/link'
import { getServerSupabase } from '@/lib/supabaseServer'

type Stats = { climbs: number; highest: number; badges: number; fas: number }
type Badge = { id: string; name: string; icon: string | null; description: string | null }

export default async function Page() {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  let stats: Stats = { climbs: 0, highest: 0, badges: 0, fas: 0 }
  let allBadges: Badge[] = []

  if (session?.user) {
    const { data: rpcData } = await supabase.rpc('get_user_stats')
    if (rpcData) {
      const row: any = Array.isArray(rpcData) ? rpcData[0] : rpcData
      stats = {
        climbs: row?.climb_count ?? 0,
        highest: row?.highest_grade ?? 0,
        badges: row?.badge_count ?? 0,
        fas: row?.fa_count ?? 0,
      }
    } else {
      const { count: climbs } = await supabase
        .from('climb_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
      const { count: badges } = await supabase
        .from('user_badges')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
      stats = { climbs: climbs ?? 0, highest: 0, badges: badges ?? 0, fas: 0 }
    }

    const { data: badgesData } = await supabase
      .from('badges')
      .select('id,name,icon,description')
      .order('name')
    allBadges = (badgesData || []) as any
  }

  const resolveIconUrl = (icon: string | null): string => {
    if (!icon) return '/icons/betabreaker_header.png'
    if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
    if (icon.startsWith('/')) return icon
    const normalized = icon.replace(/^\/?icons\//, '')
    return `/icons/${normalized}`
  }

  if (!session?.user) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Loading…</div>
      </div>
    )
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
            <div className="text-3xl font-bold">{stats.climbs}</div>
            <div className="text-xs text-base-subtext">Climbs</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats.highest}</div>
            <div className="text-xs text-base-subtext">Highest Grade</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats.badges}</div>
            <div className="text-xs text-base-subtext">Badges</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{stats.fas}</div>
            <div className="text-xs text-base-subtext">FAs</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Recent Activity</h2>
        <p className="text-base-subtext">Visit the Feed to see your latest logs and friends' activity.</p>
        <div className="mt-3">
          <Link className="btn-primary" href="/feed">Open Feed</Link>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Available Badges</h2>
        <p className="text-base-subtext mb-3">🏆 Collect them all by completing challenges and hitting milestones!</p>
        {allBadges.length === 0 && <p className="text-base-subtext">No badges defined yet.</p>}
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
