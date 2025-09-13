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
    setPendingBadges(prev => [...prev, badge])
    
    // If no popup is currently showing, show this one immediately
    if (!isPopupVisible) {
      setCurrentBadge(badge)
      setIsPopupVisible(true)
    }
  }, [isPopupVisible])

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
    badges.forEach(badge => awardBadge(badge))
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