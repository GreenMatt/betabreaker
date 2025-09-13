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
    console.log('🏆 Badge check starting for user:', userId)
    // Get user stats FIRST to avoid unnecessary queries
    const stats = await getUserStats(userId)
    console.log('📊 User stats:', stats)
    
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

    if (!recentClimb) {
      console.log('❌ No recent climb found')
      return []
    }

    const recentGrade = (recentClimb.climbs as any)?.grade || 0
    const recentType = (recentClimb.climbs as any)?.type || 'boulder'
    const wasFlash = recentClimb.attempt_type === 'flashed'
    console.log('🧗 Recent climb:', { recentGrade, recentType, wasFlash })

    // Calculate previous highest grade (excluding the most recent climb)
    const { data: previousClimbs } = await supabase
      .from('climb_logs')
      .select('climbs!inner(grade)')
      .eq('user_id', userId)
      .in('attempt_type', ['sent', 'flashed'])
      .order('date', { ascending: false })
      .limit(100)

    const previousHighestGrade = previousClimbs && previousClimbs.length > 1
      ? Math.max(...previousClimbs.slice(1).map(l => (l.climbs as any)?.grade || 0), 0)
      : 0

    console.log('📈 Grade comparison:', { recentGrade, previousHighestGrade, isNewPB: recentGrade > previousHighestGrade })

    // Check for specific achievement badges based on recent activity
    const potentialBadges = []

    // First-time achievements
    if (stats.climbCount === 1) {
      potentialBadges.push({ type: 'first_send', criteria: { climbCount: 1 } })
    }

    // Grade milestones (only check if this recent climb achieved a new highest grade)
    if (recentGrade > previousHighestGrade && recentGrade >= 3) {
      console.log('🎯 Adding grade milestone for grade:', recentGrade)
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

    console.log('🎖️ Potential badges to check:', potentialBadges)
    console.log('👤 User already has these badge IDs:', Array.from(earnedBadgeIds))
    console.log('🧗‍♂️ Recent grade info:', { recentGrade, previousHighestGrade, wasFlash, statsClimbCount: stats.climbCount })

    // Now get actual badges from database that match our potential achievements
    const { data: allBadges, error: badgeError } = await supabase
      .from('badges')
      .select('id, name, description, icon, criteria')

    if (badgeError) {
      console.error('❌ Error fetching badges:', badgeError)
      return []
    }

    if (!allBadges) {
      console.log('❌ No badges found in database')
      return []
    }

    console.log('💾 Available badges in database:', allBadges.length)
    console.log('🗃️ All badges:', allBadges)
    console.log('🔄 About to start badge loop with', allBadges.length, 'badges')
    const newBadges: Badge[] = []

    for (const badge of allBadges) {
      console.log('🔍 Checking badge:', badge.name, 'with criteria:', badge.criteria)

      // Skip if user already has this badge
      if (earnedBadgeIds.has(badge.id)) {
        console.log('⏭️ User already has badge:', badge.name)
        continue
      }

      // Only check badges that are relevant to recent activity
      const isRelevant = potentialBadges.some(pb => {
        const criteria = badge.criteria || {}

        // First send badge
        if (pb.type === 'first_send' && criteria.type === 'first_send') return true

        // Grade/level milestones - handle both formats
        if (pb.type === 'grade_milestone') {
          // New format: {type: 'level', level: X} - only award the exact grade achieved
          if (criteria.type === 'level' && criteria.level && criteria.level === recentGrade) return true
          // Legacy format: {highestGrade: X} - only award the exact grade achieved
          if (criteria.highestGrade && criteria.highestGrade === recentGrade) return true
        }

        // Flash achievements
        if (pb.type === 'flash_achievement' && wasFlash && criteria.flashCount) return true

        // Climb count milestones
        if (pb.type === 'climb_milestone' && criteria.climbCount === stats.climbCount) return true

        // Points milestones
        if (pb.type === 'points_milestone' && criteria.totalPoints === pointsMilestone) return true

        return false
      })

      console.log('📋 Badge relevance check:', { badgeName: badge.name, isRelevant })

      if (isRelevant) {
        const meetsCrit = meetsCriteria(stats, badge.criteria)
        console.log('✅ Criteria check:', { badgeName: badge.name, meetsCrit, userStats: stats, badgeCriteria: badge.criteria })

        if (meetsCrit) {
          console.log('🏆 Awarding badge:', badge.name)
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
    }

    console.log('✅ Badge check complete. New badges awarded:', newBadges.length)
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

  // Handle different badge criteria formats

  // First send badge
  if (criteria.type === 'first_send') {
    return stats.climbCount >= 1
  }

  // Level/grade badges - handle both formats
  if (criteria.type === 'level' && criteria.level) {
    return stats.highestGrade >= criteria.level
  }

  // Legacy format support
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
  console.log('🚀 Triggering badge check for user:', userId)
  const newBadges = await checkAndAwardBadges(userId)
  console.log('🎁 Badge check result:', newBadges)
  if (newBadges.length > 0) {
    console.log('🎉 Calling award callback with badges:', newBadges.map(b => b.name))
    awardCallback(newBadges)
  } else {
    console.log('📭 No new badges to award')
  }
}