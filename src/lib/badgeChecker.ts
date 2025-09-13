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
    // Get user stats FIRST to avoid unnecessary queries
    const stats = await getUserStats(userId)
    
    // Get user's current badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)

    const earnedBadgeIds = new Set((userBadges || []).map(ub => ub.badge_id))

    // Get user's recent climb to check incremental progress
    const { data: recentClimb } = await supabase
      .from('climb_logs')
      .select('attempt_type, climbs!inner(grade, type)')
      .eq('user_id', userId)
      .in('attempt_type', ['sent', 'flashed'])
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!recentClimb) return []

    const recentGrade = (recentClimb.climbs as any)?.grade || 0
    const recentType = (recentClimb.climbs as any)?.type || 'boulder'
    const wasFlash = recentClimb.attempt_type === 'flashed'

    // Check for specific achievement badges based on recent activity
    const potentialBadges = []

    // First-time achievements
    if (stats.climbCount === 1) {
      potentialBadges.push({ type: 'first_send', criteria: { climbCount: 1 } })
    }

    // Grade milestones (only check if this recent climb is highest grade)
    if (recentGrade === stats.highestGrade && recentGrade >= 3) {
      potentialBadges.push({ type: 'grade_milestone', criteria: { highestGrade: recentGrade } })
    }

    // Flash achievements
    if (wasFlash) {
      potentialBadges.push({ type: 'flash_achievement', criteria: { flashCount: stats.flashCount } })
    }

    // Milestone achievements (only check at specific numbers)
    const milestones = [5, 10, 25, 50, 100, 250, 500]
    if (milestones.includes(stats.climbCount)) {
      potentialBadges.push({ type: 'climb_milestone', criteria: { climbCount: stats.climbCount } })
    }

    // Points milestones (only check at specific thresholds)
    const pointsMilestones = [100, 500, 1000, 2500, 5000, 10000]
    const pointsMilestone = pointsMilestones.find(m => 
      stats.totalPoints >= m && stats.totalPoints - calculateClimbPoints(recentGrade, recentType, wasFlash) < m
    )
    if (pointsMilestone) {
      potentialBadges.push({ type: 'points_milestone', criteria: { totalPoints: pointsMilestone } })
    }

    // Now get actual badges from database that match our potential achievements
    const { data: allBadges } = await supabase
      .from('badges')
      .select('id, name, description, icon, criteria')

    if (!allBadges) return []

    const newBadges: Badge[] = []
    
    for (const badge of allBadges) {
      // Skip if user already has this badge
      if (earnedBadgeIds.has(badge.id)) continue
      
      // Only check badges that are relevant to recent activity
      const isRelevant = potentialBadges.some(pb => {
        const criteria = badge.criteria || {}
        if (pb.type === 'first_send' && criteria.climbCount === 1) return true
        if (pb.type === 'grade_milestone' && criteria.highestGrade === recentGrade) return true
        if (pb.type === 'flash_achievement' && wasFlash && criteria.flashCount) return true
        if (pb.type === 'climb_milestone' && criteria.climbCount === stats.climbCount) return true
        if (pb.type === 'points_milestone' && criteria.totalPoints === pointsMilestone) return true
        return false
      })

      if (isRelevant && meetsCriteria(stats, badge.criteria)) {
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

function calculateClimbPoints(grade: number, type: string, wasFlash: boolean): number {
  let points = 0
  switch (type) {
    case 'boulder': points = grade * 10; break
    case 'top_rope': points = grade * 5; break
    case 'lead': points = grade * 15; break
    default: points = grade * 10; break
  }
  return points
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