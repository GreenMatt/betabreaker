"use client"
import { useEffect, useState } from 'react'

type Badge = {
  id: string
  name: string
  description: string | null
  icon: string | null
}

type BadgeAwardPopupProps = {
  badge: Badge
  isVisible: boolean
  onClose: () => void
}

export default function BadgeAwardPopup({ badge, isVisible, onClose }: BadgeAwardPopupProps) {
  const [animationPhase, setAnimationPhase] = useState<'hidden' | 'entering' | 'visible' | 'celebrating' | 'exiting'>('hidden')

  useEffect(() => {
    if (isVisible) {
      // Phase 1: Enter with scale and glow
      setAnimationPhase('entering')
      
      // Phase 2: Settle into view
      const timer1 = setTimeout(() => {
        setAnimationPhase('visible')
      }, 300)

      // Phase 3: Celebration burst
      const timer2 = setTimeout(() => {
        setAnimationPhase('celebrating')
      }, 800)

      // Auto close after celebration
      const timer3 = setTimeout(() => {
        setAnimationPhase('exiting')
        setTimeout(onClose, 400)
      }, 4000)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    } else {
      setAnimationPhase('hidden')
    }
  }, [isVisible, onClose])

  const resolveIconUrl = (icon: string | null): string => {
    if (!icon) return '/icons/betabreaker_header.png'
    if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/')) return icon
    return `/icons/${icon}`
  }

  if (!isVisible && animationPhase === 'hidden') return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-500 ${
        animationPhase === 'hidden' || animationPhase === 'exiting' 
          ? 'opacity-0 pointer-events-none' 
          : 'opacity-100'
      }`}
      onClick={onClose}
    >
      {/* Animated Background */}
      <div className={`absolute inset-0 transition-all duration-700 ${
        animationPhase === 'celebrating' 
          ? 'bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-yellow-900/40' 
          : 'bg-black/50'
      } backdrop-blur-sm`} />

      {/* Floating Celebration Particles */}
      {animationPhase === 'celebrating' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`absolute animate-bounce-float w-2 h-2 rounded-full ${
                i % 4 === 0 ? 'bg-yellow-400' :
                i % 4 === 1 ? 'bg-purple-400' :
                i % 4 === 2 ? 'bg-pink-400' : 'bg-blue-400'
              }`}
              style={{
                left: `${10 + (i * 8)}%`,
                top: `${20 + (i % 3) * 20}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      )}

      {/* Main Badge Card */}
      <div 
        className={`relative max-w-md w-full transition-all duration-500 ease-out ${
          animationPhase === 'entering' 
            ? 'scale-50 rotate-12 opacity-0' 
            : animationPhase === 'visible'
            ? 'scale-100 rotate-0 opacity-100'
            : animationPhase === 'celebrating'
            ? 'scale-105 rotate-0 opacity-100'
            : animationPhase === 'exiting'
            ? 'scale-95 opacity-0'
            : 'scale-50 opacity-0'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow Effect */}
        <div className={`absolute inset-0 rounded-3xl transition-all duration-1000 ${
          animationPhase === 'celebrating'
            ? 'bg-gradient-to-r from-yellow-400/20 via-purple-400/20 to-pink-400/20 blur-xl scale-110'
            : 'bg-gradient-to-r from-purple-400/10 to-pink-400/10 blur-lg scale-105'
        }`} />
        
        {/* Card Content */}
        <div className="relative bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-3xl border-2 border-purple-200 shadow-2xl overflow-hidden">
          {/* Sparkle Overlay */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 w-1 h-1 bg-yellow-400 rounded-full animate-ping" />
            <div className="absolute top-8 right-6 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{animationDelay: '0.5s'}} />
            <div className="absolute bottom-6 left-8 w-1 h-1 bg-pink-400 rounded-full animate-ping" style={{animationDelay: '1s'}} />
            <div className="absolute bottom-4 right-4 w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{animationDelay: '1.5s'}} />
          </div>

          {/* Header */}
          <div className="relative px-8 pt-8 pb-4 text-center">
            <div className={`text-6xl mb-4 transition-all duration-700 ${
              animationPhase === 'celebrating' ? 'animate-bounce' : ''
            }`}>
              🏆
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Badge Unlocked!
            </h2>
            <div className="h-px bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
          </div>

          {/* Badge Display */}
          <div className="relative px-8 pb-6">
            <div className={`flex flex-col items-center gap-4 transition-all duration-500 ${
              animationPhase === 'celebrating' ? 'scale-105' : 'scale-100'
            }`}>
              {/* Badge Icon */}
              <div className={`relative transition-all duration-700 ${
                animationPhase === 'celebrating' ? 'animate-pulse' : ''
              }`}>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-md opacity-50" />
                <img
                  src={resolveIconUrl(badge.icon)}
                  alt={badge.name}
                  className="relative w-24 h-24 rounded-full object-contain bg-gradient-to-br from-yellow-100 to-orange-100 border-4 border-yellow-400 shadow-xl"
                />
                {/* Rotating Ring */}
                <div className={`absolute inset-0 border-2 border-dashed border-yellow-400 rounded-full transition-all duration-2000 ${
                  animationPhase === 'celebrating' ? 'animate-spin' : ''
                }`} style={{borderRadius: '50%'}} />
              </div>

              {/* Badge Info */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-gray-800">{badge.name}</h3>
                {badge.description && (
                  <p className="text-sm text-gray-600 max-w-xs leading-relaxed">{badge.description}</p>
                )}
              </div>

              {/* Celebration Message */}
              <div className={`transition-all duration-500 ${
                animationPhase === 'celebrating' 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}>
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                  🎉 Awesome achievement! 🎉
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8">
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
            >
              Continue Climbing! 🧗‍♀️
            </button>
          </div>
        </div>
      </div>

      {/* Click to close hint */}
      <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/60 text-sm transition-all duration-500 ${
        animationPhase === 'visible' ? 'opacity-100' : 'opacity-0'
      }`}>
        Click anywhere to close
      </div>

      <style jsx>{`
        @keyframes bounce-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(90deg); }
          50% { transform: translateY(-30px) rotate(180deg); }
          75% { transform: translateY(-20px) rotate(270deg); }
        }
        .animate-bounce-float {
          animation: bounce-float 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}