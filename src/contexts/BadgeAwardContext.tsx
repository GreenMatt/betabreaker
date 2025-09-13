"use client"
import React, { createContext, useContext, ReactNode } from 'react'
import { useBadgeAwards } from '@/hooks/useBadgeAwards'
import BadgeAwardPopup from '@/components/BadgeAwardPopup'

type Badge = {
  id: string
  name: string
  description: string | null
  icon: string | null
}

type BadgeAwardContextType = {
  awardBadge: (badge: Badge) => void
  awardMultipleBadges: (badges: Badge[]) => void
  hasPendingBadges: boolean
}

const BadgeAwardContext = createContext<BadgeAwardContextType | undefined>(undefined)

export function BadgeAwardProvider({ children }: { children: ReactNode }) {
  const {
    currentBadge,
    isPopupVisible,
    closePopup,
    awardBadge,
    awardMultipleBadges,
    hasPendingBadges
  } = useBadgeAwards()

  return (
    <BadgeAwardContext.Provider value={{
      awardBadge,
      awardMultipleBadges,
      hasPendingBadges
    }}>
      {children}
      
      {/* Global Badge Award Popup */}
      {currentBadge && (
        <BadgeAwardPopup
          badge={currentBadge}
          isVisible={isPopupVisible}
          onClose={closePopup}
        />
      )}
    </BadgeAwardContext.Provider>
  )
}

export function useBadgeAwardContext() {
  const context = useContext(BadgeAwardContext)
  if (context === undefined) {
    throw new Error('useBadgeAwardContext must be used within a BadgeAwardProvider')
  }
  return context
}