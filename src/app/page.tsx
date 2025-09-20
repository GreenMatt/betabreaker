// app/page.tsx
// Server-rendered home to avoid client auth bootstrap gaps

import Link from 'next/link'
import { getServerSupabase } from '@/lib/supabaseServer'

type Stats = { climbs: number; highest: number; badges: number; fas: number }

export default async function Page() {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  let stats: Stats = { climbs: 0, highest: 0, badges: 0, fas: 0 }
  let userName = ''

  if (session?.user) {
    // Get user's name
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', session.user.id)
      .maybeSingle()

    if (userData?.name) {
      // Extract first name (everything before the first space)
      userName = userData.name.split(' ')[0]
    }
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
        <h1 className="text-2xl font-bold mb-2">
          Welcome back{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-base-subtext">Log your climbs, track progress, and challenge friends.</p>
        <div className="mt-4 flex gap-3">
          <Link className="btn-primary" href="/log">Quick Log</Link>
          <Link className="btn-primary" href="/gym">Browse Gyms</Link>
        </div>
      </section>

      {/* Banner Image */}
      <section className="rounded-xl overflow-hidden">
        <img
          src="/images/banner.jpg"
          alt="Epic indoor bouldering"
          className="w-full h-56 object-cover"
        />
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

    </div>
  )
}
