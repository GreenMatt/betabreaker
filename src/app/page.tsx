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
    
    // Wait for initial session to be established
    const initializeData = async () => {
      console.log('Main page initializing data...')
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('Main page session check:', { hasSession: !!sessionData?.session })
      
      if (!sessionData?.session?.user) {
        console.log('No session found, redirecting to login')
        router.replace('/login')
      } else {
        console.log('Session found, loading data for user:', sessionData.session.user.id)
        // Load data immediately when we have a session
        loadStats()
        loadAllBadges()
      }
    }
    
    initializeData()
    
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change in main page:', event, !!session)
      if (!session?.user) {
        router.replace('/login')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('Auth event triggered, loading data')
        loadStats()
        loadAllBadges()
      }
    })
    unsub = () => sub.subscription.unsubscribe()
    return () => { unsub?.() }
  }, [router])

  async function loadStats() {
    console.log('Loading stats...')
    
    // Check current session first
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    console.log('Current session:', { 
      hasSession: !!sessionData?.session, 
      sessionError: sessionError?.message,
      userId: sessionData?.session?.user?.id 
    })
    
    if (!sessionData?.session) {
      console.warn('No active session when loading stats - clearing data and redirecting')
      setStats(null)
      router.replace('/login')
      return
    }
    
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
    console.log('Using fallback stats loading...')
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    console.log('Fallback user ID:', uid)
    if (!uid) {
      console.warn('No user ID available for fallback stats')
      return
    }
    
    const logs = await supabase.from('climb_logs').select('climb:climbs(grade)').eq('user_id', uid)
    console.log('Climb logs query result:', { data: logs.data, error: logs.error })
    
    if (logs.error) {
      console.error('Failed to load climb logs, checking session validity...')
      const { data: currentSession } = await supabase.auth.getSession()
      if (!currentSession?.session) {
        console.warn('Session invalid, redirecting to login')
        router.replace('/login')
        return
      }
    }
    
    const climbs = logs.data || []
    const highest = climbs.reduce((m, r: any) => Math.max(m, r.climb?.grade ?? 0), 0)
    
    const { count: c1, error: c1Error } = await supabase.from('climb_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid)
    console.log('Climb logs count:', { count: c1, error: c1Error?.message })
    
    const { count: c2, error: c2Error } = await supabase.from('user_badges').select('user_id', { count: 'exact', head: true }).eq('user_id', uid)
    console.log('User badges count:', { count: c2, error: c2Error?.message })
    
    if (c1Error || c2Error) {
      console.error('Database queries failed, checking session validity...')
      const { data: currentSession } = await supabase.auth.getSession()
      if (!currentSession?.session) {
        console.warn('Session invalid, redirecting to login')
        router.replace('/login')
        return
      }
    }
    
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
    
    // Check current session first
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    console.log('Session for badges:', { 
      hasSession: !!sessionData?.session, 
      sessionError: sessionError?.message 
    })
    
    const { data, error } = await supabase.from('badges').select('id,name,icon,description').order('name')
    console.log('Badges result:', { 
      data: data ? `${data.length} items` : 'null', 
      error: error?.message,
      fullError: error 
    })
    
    if (!error) {
      setAllBadges(data || [])
    } else {
      console.error('Badges loading error:', error)
      // Check if this is a session issue
      if (error.message?.includes('JWT') || error.code === 'PGRST301') {
        console.warn('Session invalid during badges loading, checking session...')
        const { data: currentSession } = await supabase.auth.getSession()
        if (!currentSession?.session) {
          console.warn('Session invalid, redirecting to login')
          setAllBadges([])
          router.replace('/login')
        }
      }
    }
  }

  const handleManualRefresh = async () => {
    console.log('Manual refresh triggered')
    setStats(null)
    setAllBadges([])
    loadStats()
    loadAllBadges()
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-base-subtext">Log your climbs, track progress, and challenge friends.</p>
        <div className="mt-4 flex gap-3">
          <Link className="btn-primary" href="/log">Quick Log</Link>
          <Link className="btn-primary" href="/gym">Browse Gyms</Link>
          <button className="btn-primary" onClick={handleManualRefresh}>Refresh Data</button>
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
