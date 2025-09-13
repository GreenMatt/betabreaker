"use client"
import { useState, useCallback } from 'react'

type Badge = {
  id: string
  name: string
  description: string | null
  icon: string | null
}

export function useBadgeAwards() {
  const [pendingBadges, setPendingBadges] = useState<Badge[]>([])
  const [currentBadge, setCurrentBadge] = useState<Badge | null>(null)
  const [isPopupVisible, setIsPopupVisible] = useState(false)

  const awardBadge = useCallback((badge: Badge) => {
    console.log('🎯 awardBadge called for:', badge.name, 'ID:', badge.id)
    console.log('🎯 Current state - isPopupVisible:', isPopupVisible, 'currentBadge:', currentBadge?.name)

    // Check if this exact badge is already being processed
    if (currentBadge?.id === badge.id && isPopupVisible) {
      console.log('🚫 EXACT same badge already showing, ignoring:', badge.name)
      return
    }

    // Add to pending queue
    setPendingBadges(prev => {
      const alreadyPending = prev.some(b => b.id === badge.id)

      if (alreadyPending) {
        console.log('🚫 Badge already in pending queue:', badge.name)
        return prev
      }

      console.log('✅ Adding badge to pending queue:', badge.name)
      return [...prev, badge]
    })

    // If no popup is currently showing, show this one immediately
    if (!isPopupVisible) {
      console.log('✅ No popup showing, displaying immediately:', badge.name)
      setCurrentBadge(badge)
      setIsPopupVisible(true)
    } else {
      console.log('⏳ Popup already showing, badge queued:', badge.name)
    }
  }, [isPopupVisible, currentBadge])

  const closePopup = useCallback(() => {
    console.log('🔄 closePopup called, current badge:', currentBadge?.name)
    setIsPopupVisible(false)
    setCurrentBadge(null)

    // Remove the current badge from pending and show next one if available
    setPendingBadges(prev => {
      console.log('🔄 Pending badges before processing:', prev.map(b => b.name))
      const remaining = prev.slice(1)
      console.log('🔄 Remaining badges after removing first:', remaining.map(b => b.name))

      // Show next badge if available
      if (remaining.length > 0) {
        console.log('🔄 Showing next badge after 500ms:', remaining[0].name)
        setTimeout(() => {
          setCurrentBadge(remaining[0])
          setIsPopupVisible(true)
        }, 500) // Small delay between popups
      } else {
        console.log('🔄 No more badges in queue')
      }

      return remaining
    })
  }, [currentBadge])

  const awardMultipleBadges = useCallback((badges: Badge[]) => {
    console.log('🎁 awardMultipleBadges called with:', badges.map(b => b.name))

    // Should only receive single badge arrays from the updated triggerBadgeCheck
    if (badges.length === 1) {
      awardBadge(badges[0])
    } else if (badges.length > 1) {
      // Fallback: handle multiple badges with deduplication
      const badgeMap = new Map<string, Badge>()
      badges.forEach(badge => {
        if (!badgeMap.has(badge.id)) {
          badgeMap.set(badge.id, badge)
        }
      })
      const uniqueBadges = Array.from(badgeMap.values())
      console.log('🔄 Processing multiple badges:', uniqueBadges.map(b => b.name))
      uniqueBadges.forEach(badge => awardBadge(badge))
    }
  }, [awardBadge])

  return {
    currentBadge,
    isPopupVisible,
    closePopup,
    awardBadge,
    awardMultipleBadges,
    hasPendingBadges: pendingBadges.length > 0
  }
}