import { supabase } from './supabaseClient'

type Badge = {
  id: string
  name: string
  description: string | null
  icon: string | null
  criteria: any
}

type UserStats = {
  climbCount: number
  highestGrade: number
  flashCount: number
  uniqueGyms: number
  consecutiveDays: number
  totalPoints: number
}

export async function checkAndAwardBadges(userId: string): Promise<Badge[]> {
  try {
    // Get all available badges
    const { data: allBadges } = await supabase
      .from('badges')
      .select('id, name, description, icon, criteria')

    if (!allBadges) return []

    // Get user's current badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)

    const earnedBadgeIds = new Set((userBadges || []).map(ub => ub.badge_id))

    // Get user stats
    const stats = await getUserStats(userId)
    
    // Check each badge criteria
    const newBadges: Badge[] = []
    
    for (const badge of allBadges) {
      // Skip if user already has this badge
      if (earnedBadgeIds.has(badge.id)) continue
      
      // Check if user meets criteria
      if (meetsCriteria(stats, badge.criteria)) {
        newBadges.push(badge)
        
        // Award the badge in database
        await supabase
          .from('user_badges')
          .insert({
            user_id: userId,
            badge_id: badge.id
          })
      }
    }
    
    return newBadges
  } catch (error) {
    console.error('Error checking badges:', error)
    return []
  }
}

async function getUserStats(userId: string): Promise<UserStats> {
  // Get climb logs
  const { data: logs } = await supabase
    .from('climb_logs')
    .select(`
      id,
      attempt_type,
      date,
      climbs!inner(grade, gym_id, type)
    `)
    .eq('user_id', userId)
    .in('attempt_type', ['sent', 'flashed'])

  if (!logs) {
    return {
      climbCount: 0,
      highestGrade: 0,
      flashCount: 0,
      uniqueGyms: 0,
      consecutiveDays: 0,
      totalPoints: 0
    }
  }

  const climbCount = logs.length
  const flashCount = logs.filter(l => l.attempt_type === 'flashed').length
  const highestGrade = Math.max(...logs.map(l => (l.climbs as any).grade || 0), 0)
  const uniqueGyms = new Set(logs.map(l => (l.climbs as any).gym_id)).size
  
  // Calculate total points
  let totalPoints = 0
  for (const log of logs) {
    const climb = log.climbs as any
    const grade = climb.grade || 0
    switch (climb.type) {
      case 'boulder': totalPoints += grade * 10; break
      case 'top_rope': totalPoints += grade * 5; break
      case 'lead': totalPoints += grade * 15; break
      default: totalPoints += grade * 10; break
    }
  }

  // Calculate consecutive days (simplified - would need more complex logic for real streaks)
  const uniqueDates = [...new Set(logs.map(l => l.date.split('T')[0]))].sort()
  let consecutiveDays = 0
  let currentStreak = 1
  
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i-1])
    const currDate = new Date(uniqueDates[i])
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (diffDays === 1) {
      currentStreak++
    } else {
      consecutiveDays = Math.max(consecutiveDays, currentStreak)
      currentStreak = 1
    }
  }
  consecutiveDays = Math.max(consecutiveDays, currentStreak)

  return {
    climbCount,
    highestGrade,
    flashCount,
    uniqueGyms,
    consecutiveDays,
    totalPoints
  }
}

function meetsCriteria(stats: UserStats, criteria: any): boolean {
  if (!criteria || typeof criteria !== 'object') return false

  // Example criteria checks
  if (criteria.climbCount && stats.climbCount < criteria.climbCount) return false
  if (criteria.highestGrade && stats.highestGrade < criteria.highestGrade) return false
  if (criteria.flashCount && stats.flashCount < criteria.flashCount) return false
  if (criteria.uniqueGyms && stats.uniqueGyms < criteria.uniqueGyms) return false
  if (criteria.consecutiveDays && stats.consecutiveDays < criteria.consecutiveDays) return false
  if (criteria.totalPoints && stats.totalPoints < criteria.totalPoints) return false

  return true
}

// Helper function to trigger badge check after important actions
export async function triggerBadgeCheck(userId: string, awardCallback: (badges: Badge[]) => void) {
  const newBadges = await checkAndAwardBadges(userId)
  if (newBadges.length > 0) {
    awardCallback(newBadges)
  }
}