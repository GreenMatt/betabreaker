"use client"
import Link from 'next/link'
import { useAuth } from '@/lib/authContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Page() {
  const { user } = useAuth()
  const [stats, setStats] = useState<{ climbs: number, highest: number, badges: number, fas: number } | null>(null)
  const [allBadges, setAllBadges] = useState<Array<{ id: string, name: string, icon: string | null, description: string | null }>>([])

  useEffect(() => {
    if (user) {
      console.log('Page: User available, loading data for:', user.email)
      loadData()
    } else {
      console.log('Page: No user, clearing data')
      setStats(null)
      setAllBadges([])
    }
  }, [user, user?.id])

  const loadData = async (retryCount = 0) => {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second
    
    try {
      console.log(`Simple page: Loading data... (attempt ${retryCount + 1}/${maxRetries + 1})`)
      
      // First validate session before trying to load data
      console.log('Simple page: Validating session...')
      let sessionData, sessionError
      
      try {
        // Use main client with timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 3000)
        )
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any
        sessionData = result.data
        sessionError = result.error
        
        console.log('Simple page: Session check completed:', { 
          hasSession: !!sessionData?.session, 
          sessionError: sessionError?.message,
          userId: sessionData?.session?.user?.id,
          expiresAt: sessionData?.session?.expires_at ? new Date(sessionData.session.expires_at * 1000).toLocaleString() : 'N/A'
        })
      } catch (e: any) {
        console.error('Simple page: Session check failed/timeout:', e.message)
        
        // Fallback: try to read session from localStorage directly
        console.log('Simple page: Trying localStorage fallback...')
        try {
          if (typeof window !== 'undefined') {
            const storedSession = window.localStorage.getItem('supabase.auth.token')
            console.log('Simple page: localStorage session:', !!storedSession)
            if (storedSession) {
              const parsed = JSON.parse(storedSession)
              console.log('Simple page: Parsed session:', { 
                hasAccessToken: !!parsed?.access_token,
                expiresAt: parsed?.expires_at ? new Date(parsed.expires_at * 1000).toLocaleString() : 'N/A'
              })
              
              // If we have a stored session that's not expired, restore it to the client
              if (parsed?.access_token && parsed?.expires_at && parsed.expires_at > Date.now() / 1000) {
                console.log('Simple page: Using valid localStorage session - restoring to client')
                try {
                  // Set the session on the client so RPC calls work
                  await supabase.auth.setSession({
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token
                  })
                  console.log('Simple page: Session restored to client successfully')
                  sessionData = { session: parsed }
                  sessionError = null
                } catch (restoreError: any) {
                  console.error('Simple page: Failed to restore session to client:', restoreError.message)
                  sessionData = { session: null }
                  sessionError = { message: 'Session restore failed' }
                }
              } else {
                console.log('Simple page: localStorage session expired or invalid')
                sessionData = { session: null }
                sessionError = { message: 'Session expired' }
              }
            } else {
              sessionData = { session: null }
              sessionError = { message: 'No stored session' }
            }
          }
        } catch (localStorageError: any) {
          console.error('Simple page: localStorage fallback failed:', localStorageError.message)
          sessionData = { session: null }
          sessionError = { message: e.message }
        }
      }
      
      if (!sessionData?.session) {
        console.error('Simple page: No valid session available!')
        
        // If this is a retry due to timing issues, don't give up immediately
        if (retryCount < maxRetries) {
          console.log('Simple page: Session not ready, will retry...')
          throw new Error('Session not ready - will retry')
        }
        
        // Only try refresh session on the final attempt
        console.log('Simple page: Final attempt - trying to refresh session...')
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          console.log('Simple page: Refresh session result:', { 
            hasSession: !!refreshData?.session, 
            error: refreshError?.message 
          })
          
          if (!refreshData?.session) {
            console.error('Simple page: Session refresh failed, giving up')
            throw new Error('Session refresh failed')
          }
          
          console.log('Simple page: Session refreshed successfully')
        } catch (e: any) {
          console.error('Simple page: Session refresh exception:', e.message)
          throw new Error('Session refresh failed')
        }
      }
      
      console.log('Simple page: Session valid, loading stats and badges')

      // Load stats with detailed error handling
      try {
        console.log('Simple page: Calling get_user_stats RPC...')
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_stats')
        console.log('Simple page: RPC response:', { data: rpcData, error: rpcError?.message, code: rpcError?.code })
        
        if (!rpcError && rpcData) {
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
          console.log('Simple page: Processing RPC row:', row)
          if (row) {
            const newStats = {
              climbs: row.climb_count ?? 0,
              highest: row.highest_grade ?? 0,
              badges: row.badge_count ?? 0,
              fas: row.fa_count ?? 0
            }
            setStats(newStats)
            console.log('Simple page: Stats set successfully:', newStats)
          } else {
            console.warn('Simple page: RPC returned no data rows')
            setStats({ climbs: 0, highest: 0, badges: 0, fas: 0 })
          }
        } else {
          console.warn('Simple page: RPC failed, trying fallback:', rpcError?.message, rpcError?.code)
          // Fallback to basic queries
          console.log('Simple page: Fallback - loading climb count...')
          const { count: climbs, error: climbError } = await supabase.from('climb_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
          console.log('Simple page: Fallback climb result:', { count: climbs, error: climbError?.message })
          
          console.log('Simple page: Fallback - loading badge count...')
          const { count: badges, error: badgeError } = await supabase.from('user_badges').select('user_id', { count: 'exact', head: true }).eq('user_id', user.id)
          console.log('Simple page: Fallback badge result:', { count: badges, error: badgeError?.message })
          
          const fallbackStats = { climbs: climbs ?? 0, highest: 0, badges: badges ?? 0, fas: 0 }
          setStats(fallbackStats)
          console.log('Simple page: Fallback stats loaded:', fallbackStats)
        }
      } catch (e) {
        console.error('Simple page: Stats loading exception:', e)
        setStats({ climbs: 0, highest: 0, badges: 0, fas: 0 })
      }

      // Load badges with detailed error handling
      try {
        console.log('Simple page: Loading badges...')
        const { data: badgesData, error: badgesError } = await supabase.from('badges').select('id,name,icon,description').order('name')
        console.log('Simple page: Badges response:', { 
          dataLength: badgesData?.length, 
          error: badgesError?.message, 
          code: badgesError?.code 
        })
        
        if (!badgesError && badgesData) {
          setAllBadges(badgesData)
          console.log('Simple page: Badges set successfully:', badgesData.length, 'badges')
        } else {
          console.warn('Simple page: Badges query failed:', badgesError?.message, badgesError?.code)
          setAllBadges([])
        }
      } catch (e) {
        console.error('Simple page: Badges loading exception:', e)
        setAllBadges([])
      }

    } catch (e) {
      console.error('Simple page: Load error:', e)
      
      // Retry logic for timing/race conditions
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount) // Exponential backoff: 1s, 2s, 4s
        console.log(`Simple page: Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        
        setTimeout(() => {
          loadData(retryCount + 1)
        }, delay)
      } else {
        console.error('Simple page: Max retries reached, giving up')
        // Set empty data as fallback
        setStats({ climbs: 0, highest: 0, badges: 0, fas: 0 })
        setAllBadges([])
      }
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