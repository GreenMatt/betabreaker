// Example of StrictMode-safe useEffect that triggers badge checks
import { useEffect, useRef } from 'react'
import { useBadgeAwardContext } from '@/contexts/BadgeAwardContext'
import { triggerBadgeCheck } from '@/lib/badgeChecker'

export function StrictModeSafeBadgeCheck({ userId, climbLogId }: { userId: string, climbLogId?: string }) {
  const { awardMultipleBadges } = useBadgeAwardContext()
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    // StrictMode guard: prevent double-firing in development
    if (hasTriggeredRef.current) {
      console.log('🚫 Badge check already triggered, skipping (StrictMode protection)')
      return
    }

    // Only trigger if we have a user ID and this effect hasn't run yet
    if (!userId) return

    hasTriggeredRef.current = true

    // Optional: trigger only after a specific event like a new climb log
    if (climbLogId) {
      console.log('🎯 Triggering badge check after climb log:', climbLogId)
      triggerBadgeCheck(userId, awardMultipleBadges)
    }

    // Cleanup function to reset the ref if component unmounts
    return () => {
      hasTriggeredRef.current = false
    }
  }, [userId, climbLogId, awardMultipleBadges])

  return null // This is just a utility component
}

// Alternative pattern: trigger badge check in a callback
export function useBadgeCheckTrigger() {
  const { awardMultipleBadges } = useBadgeAwardContext()
  const triggerInProgress = useRef(false)

  const triggerBadgeCheckSafe = async (userId: string) => {
    // Prevent concurrent triggers
    if (triggerInProgress.current) {
      console.log('🚫 Badge check trigger already in progress')
      return
    }

    triggerInProgress.current = true

    try {
      await triggerBadgeCheck(userId, awardMultipleBadges)
    } finally {
      triggerInProgress.current = false
    }
  }

  return triggerBadgeCheckSafe
}