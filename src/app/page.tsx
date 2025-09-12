"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Page() {
  const router = useRouter()
  const [stats, setStats] = useState<{ climbs: number, highest: number, badges: number, fas: number } | null>(null)
  const [allBadges, setAllBadges] = useState<Array<{ id: string, name: string, icon: string | null, description: string | null }>>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    console.log('Simple page: Starting...')
    loadData()
    
    // Simple auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Simple page: Auth change:', event, !!session)
      if (session?.user) {
        setUser(session.user)
        if (event === 'SIGNED_IN') {
          loadData()
        }
      } else {
        setUser(null)
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const loadData = async () => {
    try {
      console.log('Simple page: Loading data...')
      
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        console.log('Simple page: No session, redirecting')
        router.replace('/login')
        return
      }

      console.log('Simple page: Session OK, loading stats and badges')
      setUser(sessionData.session.user)

      // Load stats with simple error handling
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_stats')
        if (!rpcError && rpcData) {
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
          if (row) {
            setStats({
              climbs: row.climb_count ?? 0,
              highest: row.highest_grade ?? 0,
              badges: row.badge_count ?? 0,
              fas: row.fa_count ?? 0
            })
            console.log('Simple page: Stats loaded successfully')
          }
        } else {
          console.warn('Simple page: RPC failed:', rpcError?.message)
          // Fallback to basic queries
          const uid = sessionData.session.user.id
          const { count: climbs } = await supabase.from('climb_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid)
          const { count: badges } = await supabase.from('user_badges').select('user_id', { count: 'exact', head: true }).eq('user_id', uid)
          setStats({ climbs: climbs ?? 0, highest: 0, badges: badges ?? 0, fas: 0 })
          console.log('Simple page: Fallback stats loaded')
        }
      } catch (e) {
        console.error('Simple page: Stats error:', e)
        setStats({ climbs: 0, highest: 0, badges: 0, fas: 0 })
      }

      // Load badges with simple error handling
      try {
        const { data: badgesData, error: badgesError } = await supabase.from('badges').select('id,name,icon,description').order('name')
        if (!badgesError && badgesData) {
          setAllBadges(badgesData)
          console.log('Simple page: Badges loaded successfully:', badgesData.length)
        } else {
          console.warn('Simple page: Badges failed:', badgesError?.message)
          setAllBadges([])
        }
      } catch (e) {
        console.error('Simple page: Badges error:', e)
        setAllBadges([])
      }

    } catch (e) {
      console.error('Simple page: Load error:', e)
      router.replace('/login')
    }
  }

  const handleRefresh = () => {
    console.log('Simple page: Manual refresh')
    setStats(null)
    setAllBadges([])
    loadData()
  }

  const resolveIconUrl = (icon: string | null): string => {
    if (!icon) return '/icons/betabreaker_header.png'
    if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
    if (icon.startsWith('/')) return icon
    const normalized = icon.replace(/^\/?icons\//, '')
    return `/icons/${normalized}`
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Loading...</div>
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
          <button className="btn-primary" onClick={handleRefresh}>Refresh Data</button>
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
        <p className="text-base-subtext">Visit the Feed to see your latest logs and friends' activity.</p>
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