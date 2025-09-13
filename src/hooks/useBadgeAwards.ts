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
    // Dedup check to prevent duplicate popups for the same badge
    setPendingBadges(prev => {
      // Check if this badge is already in pending or currently showing
      const alreadyPending = prev.some(b => b.id === badge.id)
      const currentlyShowing = currentBadge?.id === badge.id && isPopupVisible

      if (alreadyPending || currentlyShowing) {
        console.log('🚫 Badge already pending or showing:', badge.name)
        return prev
      }

      return [...prev, badge]
    })

    // If no popup is currently showing, show this one immediately
    if (!isPopupVisible) {
      setCurrentBadge(badge)
      setIsPopupVisible(true)
    }
  }, [isPopupVisible, currentBadge])

  const closePopup = useCallback(() => {
    setIsPopupVisible(false)
    setCurrentBadge(null)
    
    // Remove the current badge from pending and show next one if available
    setPendingBadges(prev => {
      const remaining = prev.slice(1)
      
      // Show next badge if available
      if (remaining.length > 0) {
        setTimeout(() => {
          setCurrentBadge(remaining[0])
          setIsPopupVisible(true)
        }, 500) // Small delay between popups
      }
      
      return remaining
    })
  }, [])

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