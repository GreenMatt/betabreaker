// Server-rendered leaderboards to avoid client auth bootstrap gaps
import { getServerSupabase } from '@/lib/supabaseServer'
import LeaderboardsClient from './LeaderboardsClient'

type LeaderboardType = 'points' | 'sends' | 'grade' | 'active'
type TimePeriod = 'all_time' | 'this_month' | 'this_week'

type LeaderEntry = {
  rank: number
  user_id: string
  name: string | null
  profile_photo: string | null
  value: number
  extra_info?: string
}

interface LeaderboardsPageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function LeaderboardsPage({ searchParams }: LeaderboardsPageProps) {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  const activeType = (searchParams?.type as LeaderboardType) || 'points'
  const timePeriod = (searchParams?.period as TimePeriod) || 'all_time'

  let leaders: LeaderEntry[] = []

  if (session?.user) {
    try {
      // Build time filter
      let timeFilter = ''
      if (timePeriod === 'this_month') {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        timeFilter = startOfMonth.toISOString()
      } else if (timePeriod === 'this_week') {
        const startOfWeek = new Date()
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        timeFilter = startOfWeek.toISOString()
      }

      let leaderData: LeaderEntry[] = []

      if (activeType === 'sends') {
        // Most Sends Leaderboard
        let query = supabase
          .from('climb_logs')
          .select(`
            user_id,
            users!inner(name, profile_photo, private_profile),
            climbs!inner(grade)
          `)
          .in('attempt_type', ['sent', 'flashed'])
          .eq('users.private_profile', false)

        if (timeFilter) {
          query = query.gte('date', timeFilter)
        }

        const { data, error } = await query

        if (error) throw error

        // Group by user and calculate sends
        const userStats: Record<string, { name: string | null, profile_photo: string | null, sends: number, totalGrade: number }> = {}

        for (const log of data || []) {
          const userId = log.user_id
          if (!userStats[userId]) {
            userStats[userId] = {
              name: (log.users as any).name,
              profile_photo: (log.users as any).profile_photo,
              sends: 0,
              totalGrade: 0
            }
          }
          userStats[userId].sends += 1
          userStats[userId].totalGrade += (log.climbs as any).grade || 0
        }

        leaderData = Object.entries(userStats)
          .map(([userId, stats], index) => ({
            rank: index + 1,
            user_id: userId,
            name: stats.name,
            profile_photo: stats.profile_photo,
            value: stats.sends,
            extra_info: `Avg grade: ${(stats.totalGrade / stats.sends).toFixed(1)}`
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 50)
          .map((item, index) => ({ ...item, rank: index + 1 }))

      } else if (activeType === 'grade') {
        // Highest Grade Leaderboard
        let query = supabase
          .from('climb_logs')
          .select(`
            user_id,
            users!inner(name, profile_photo, private_profile),
            climbs!inner(grade)
          `)
          .in('attempt_type', ['sent', 'flashed'])
          .eq('users.private_profile', false)

        if (timeFilter) {
          query = query.gte('date', timeFilter)
        }

        const { data, error } = await query

        if (error) throw error

        // Group by user and find max grade
        const userStats: Record<string, { name: string | null, profile_photo: string | null, maxGrade: number, sends: number }> = {}

        for (const log of data || []) {
          const userId = log.user_id
          const grade = (log.climbs as any).grade || 0
          if (!userStats[userId]) {
            userStats[userId] = {
              name: (log.users as any).name,
              profile_photo: (log.users as any).profile_photo,
              maxGrade: grade,
              sends: 0
            }
          }
          userStats[userId].maxGrade = Math.max(userStats[userId].maxGrade, grade)
          userStats[userId].sends += 1
        }

        leaderData = Object.entries(userStats)
          .map(([userId, stats], index) => ({
            rank: index + 1,
            user_id: userId,
            name: stats.name,
            profile_photo: stats.profile_photo,
            value: stats.maxGrade,
            extra_info: `${stats.sends} total sends`
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 50)
          .map((item, index) => ({ ...item, rank: index + 1 }))

      } else if (activeType === 'points') {
        // Points Leaderboard
        let query = supabase
          .from('climb_logs')
          .select(`
            user_id,
            users!inner(name, profile_photo, private_profile),
            climbs!inner(grade, type)
          `)
          .in('attempt_type', ['sent', 'flashed'])
          .eq('users.private_profile', false)

        if (timeFilter) {
          query = query.gte('date', timeFilter)
        }

        const { data, error } = await query

        if (error) throw error

        // Calculate points for each user
        const userStats: Record<string, { name: string | null, profile_photo: string | null, points: number, sends: number }> = {}

        for (const log of data || []) {
          const userId = log.user_id
          const climb = log.climbs as any
          const grade = climb.grade || 0

          // Point calculation based on climb type
          let points = 0
          switch (climb.type) {
            case 'boulder': points = grade * 10; break
            case 'top_rope': points = grade * 5; break
            case 'lead': points = grade * 15; break
            default: points = grade * 10; break
          }

          if (!userStats[userId]) {
            userStats[userId] = {
              name: (log.users as any).name,
              profile_photo: (log.users as any).profile_photo,
              points: 0,
              sends: 0
            }
          }
          userStats[userId].points += points
          userStats[userId].sends += 1
        }

        leaderData = Object.entries(userStats)
          .map(([userId, stats], index) => ({
            rank: index + 1,
            user_id: userId,
            name: stats.name,
            profile_photo: stats.profile_photo,
            value: stats.points,
            extra_info: `${stats.sends} sends`
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 50)
          .map((item, index) => ({ ...item, rank: index + 1 }))

      } else if (activeType === 'active') {
        // Most Active Days Leaderboard
        let query = supabase
          .from('climb_logs')
          .select(`
            user_id,
            date,
            users!inner(name, profile_photo, private_profile)
          `)
          .in('attempt_type', ['sent', 'flashed'])
          .eq('users.private_profile', false)

        if (timeFilter) {
          query = query.gte('date', timeFilter)
        }

        const { data, error } = await query

        if (error) throw error

        // Count unique active days per user
        const userStats: Record<string, { name: string | null, profile_photo: string | null, activeDays: Set<string>, lastActive: string }> = {}

        for (const log of data || []) {
          const userId = log.user_id
          const date = new Date(log.date).toISOString().split('T')[0]

          if (!userStats[userId]) {
            userStats[userId] = {
              name: (log.users as any).name,
              profile_photo: (log.users as any).profile_photo,
              activeDays: new Set(),
              lastActive: log.date
            }
          }
          userStats[userId].activeDays.add(date)
          if (new Date(log.date) > new Date(userStats[userId].lastActive)) {
            userStats[userId].lastActive = log.date
          }
        }

        leaderData = Object.entries(userStats)
          .map(([userId, stats], index) => ({
            rank: index + 1,
            user_id: userId,
            name: stats.name,
            profile_photo: stats.profile_photo,
            value: stats.activeDays.size,
            extra_info: `Last: ${new Date(stats.lastActive).toLocaleDateString()}`
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 50)
          .map((item, index) => ({ ...item, rank: index + 1 }))
      }

      leaders = leaderData
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
      leaders = []
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
    <LeaderboardsClient
      initialLeaders={leaders}
      initialType={activeType}
      initialPeriod={timePeriod}
    />
  )
}
