"use client"
import { useBadgeAwardContext } from '@/contexts/BadgeAwardContext'

// Demo component to test badge awards - remove in production
export default function BadgeTestButton() {
  const { awardBadge, awardMultipleBadges } = useBadgeAwardContext()

  const testSingleBadge = () => {
    awardBadge({
      id: 'test-1',
      name: 'First Send!',
      description: 'Congratulations on logging your very first climb! Welcome to the climbing community.',
      icon: '/icons/betabreaker_header.png'
    })
  }

  const testMultipleBadges = () => {
    awardMultipleBadges([
      {
        id: 'test-2',
        name: 'Flash Master',
        description: 'You flashed 5 climbs in a row! Your technique is improving rapidly.',
        icon: '/icons/betabreaker_header.png'
      },
      {
        id: 'test-3',
        name: 'Grade Crusher',
        description: 'You just sent your first V5! Keep pushing those limits.',
        icon: '/icons/betabreaker_header.png'
      },
      {
        id: 'test-4',
        name: 'Gym Hopper',
        description: 'You\'ve climbed at 3 different gyms! Exploring new terrain builds character.',
        icon: '/icons/betabreaker_header.png'
      }
    ])
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-2">🧪 Badge Test (Dev Only)</h3>
      <div className="flex gap-2">
        <button
          className="btn-primary text-sm"
          onClick={testSingleBadge}
        >
          Test Single Badge
        </button>
        <button
          className="btn-primary text-sm"
          onClick={testMultipleBadges}
        >
          Test Multiple Badges
        </button>
      </div>
    </div>
  )
}