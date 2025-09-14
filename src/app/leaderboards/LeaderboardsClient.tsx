"use client"
import { useState } from 'react'

type LeaderboardType = 'points' | 'sends' | 'grade' | 'active'
type TimePeriod = 'all_time' | 'this_month' | 'this_week'

type LeaderEntry = {
  rank: number
  user_id: string
  name: string | null
  profile_photo: string | null
  value: number
  extra_info?: string
}

const LEADERBOARD_CONFIGS = {
  points: { label: 'Total Points', icon: '🏆', color: 'from-yellow-500 to-orange-500' },
  sends: { label: 'Most Sends', icon: '📈', color: 'from-green-500 to-emerald-500' },
  grade: { label: 'Highest Grade', icon: '⚡', color: 'from-purple-500 to-pink-500' },
  active: { label: 'Most Active', icon: '🔥', color: 'from-red-500 to-rose-500' }
}

const TIME_PERIODS = {
  all_time: 'All Time',
  this_month: 'This Month',
  this_week: 'This Week'
}

interface LeaderboardsClientProps {
  initialLeaders: LeaderEntry[]
  initialType: LeaderboardType
  initialPeriod: TimePeriod
}

export default function LeaderboardsClient({
  initialLeaders,
  initialType = 'points',
  initialPeriod = 'all_time'
}: LeaderboardsClientProps) {
  const [activeType, setActiveType] = useState<LeaderboardType>(initialType)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initialPeriod)
  const [leaders, setLeaders] = useState<LeaderEntry[]>(initialLeaders)
  const [loading, setLoading] = useState(false)

  // This will trigger a page refresh with new URL params
  function handleTypeChange(newType: LeaderboardType) {
    const url = new URL(window.location.href)
    url.searchParams.set('type', newType)
    url.searchParams.set('period', timePeriod)
    window.location.href = url.toString()
  }

  function handlePeriodChange(newPeriod: TimePeriod) {
    const url = new URL(window.location.href)
    url.searchParams.set('type', activeType)
    url.searchParams.set('period', newPeriod)
    window.location.href = url.toString()
  }


  function formatValue(value: number, type: LeaderboardType): string {
    switch (type) {
      case 'points': return value.toLocaleString()
      case 'sends': return value.toString()
      case 'grade': return value.toString()
      case 'active': return `${value} days`
      default: return value.toString()
    }
  }

  function getMedalEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈' 
      case 3: return '🥉'
      default: return ''
    }
  }

  function getPodiumStyle(rank: number): string {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
      case 2: return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30'
      case 3: return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30'
      default: return 'bg-white/5 border-white/10'
    }
  }

  const config = LEADERBOARD_CONFIGS[activeType]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-neon-purple to-pink-500 bg-clip-text text-transparent">
          🏆 Leaderboards
        </h1>
        <p className="text-base-subtext">Compete with the climbing community!</p>
      </div>

      {/* Time Period Selector */}
      <div className="flex justify-center">
        <div className="flex bg-white/10 rounded-lg p-1">
          {Object.entries(TIME_PERIODS).map(([key, label]) => (
            <button
              key={key}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                timePeriod === key
                  ? 'bg-neon-purple text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => handlePeriodChange(key as TimePeriod)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(LEADERBOARD_CONFIGS).map(([key, cfg]) => (
          <button
            key={key}
            className={`p-4 rounded-xl border transition-all duration-200 ${
              activeType === key
                ? `bg-gradient-to-r ${cfg.color} border-white/20 shadow-lg scale-105`
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
            }`}
            onClick={() => handleTypeChange(key as LeaderboardType)}
          >
            <div className="text-2xl mb-1">{cfg.icon}</div>
            <div className="text-sm font-medium text-gray-800">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-2xl">{config.icon}</div>
          <div>
            <h2 className="text-xl font-bold text-white">{config.label}</h2>
            <p className="text-sm text-base-subtext">{TIME_PERIODS[timePeriod]}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-12 text-base-subtext">
            <div className="text-4xl mb-4">📊</div>
            <p>No data available for this leaderboard yet.</p>
            <p className="text-sm mt-2">Start logging climbs to see rankings!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((leader) => (
              <div
                key={leader.user_id}
                className={`
                  relative p-4 rounded-lg border transition-all duration-200 hover:scale-[1.02]
                  ${getPodiumStyle(leader.rank)}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Rank & Medal */}
                  <div className="flex items-center gap-2">
                    <div className={`
                      text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center
                      ${leader.rank <= 3 ? 'bg-white/20' : 'bg-white/10'}
                    `}>
                      {leader.rank}
                    </div>
                    {leader.rank <= 3 && (
                      <span className="text-2xl">{getMedalEmoji(leader.rank)}</span>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {leader.profile_photo ? (
                        <img 
                          src={leader.profile_photo} 
                          alt={leader.name || 'User'} 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-pink-500 flex items-center justify-center text-white font-bold">
                          {(leader.name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-800">
                          {leader.name || 'Anonymous User'}
                        </div>
                        {leader.extra_info && (
                          <div className="text-xs text-base-subtext">
                            {leader.extra_info}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${leader.rank === 1 ? 'text-yellow-400' : leader.rank === 2 ? 'text-gray-600' : leader.rank === 3 ? 'text-amber-500' : 'text-gray-800'}`}>
                      {formatValue(leader.value, activeType)}
                    </div>
                    <div className="text-xs text-gray-800">
                      {activeType === 'points' && 'points'}
                      {activeType === 'sends' && 'sends'}
                      {activeType === 'grade' && 'max grade'}
                      {activeType === 'active' && 'active days'}
                    </div>
                  </div>
                </div>

                {/* Crown for #1 */}
                {leader.rank === 1 && (
                  <div className="absolute -top-2 -right-2">
                    <span className="text-2xl">👑</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



