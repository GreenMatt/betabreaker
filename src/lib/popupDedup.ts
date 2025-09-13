// Popup deduplication helper to prevent duplicate badge notifications
// Tracks recently shown badge IDs with TTL to avoid spam

interface PopupRecord {
  timestamp: number
  badgeId: string
}

class PopupDeduplicator {
  private shownBadges = new Map<string, number>()
  private readonly TTL_MS = 8000 // 8 seconds

  shouldShowBadgePopup(badgeId: string): boolean {
    const now = Date.now()
    const lastShown = this.shownBadges.get(badgeId)

    // Clean up expired entries (older than TTL)
    this.cleanup(now)

    // If never shown or TTL expired, allow showing
    if (!lastShown || (now - lastShown) > this.TTL_MS) {
      this.shownBadges.set(badgeId, now)
      return true
    }

    console.log(`🚫 Popup dedupe: Badge ${badgeId} shown recently, skipping`)
    return false
  }

  private cleanup(now: number) {
    for (const [badgeId, timestamp] of this.shownBadges.entries()) {
      if ((now - timestamp) > this.TTL_MS) {
        this.shownBadges.delete(badgeId)
      }
    }
  }

  // Force clear a badge (useful for testing)
  clearBadge(badgeId: string) {
    this.shownBadges.delete(badgeId)
  }

  // Clear all (useful for testing)
  clearAll() {
    this.shownBadges.clear()
  }
}

// Singleton instance
export const popupDeduplicator = new PopupDeduplicator()

export function shouldShowBadgePopup(badgeId: string): boolean {
  return popupDeduplicator.shouldShowBadgePopup(badgeId)
}