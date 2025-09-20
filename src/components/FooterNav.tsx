"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function FooterNav() {
  const pathname = usePathname() || '/'
  const router = useRouter()

  // Aggressively prefetch primary routes to speed up tab switches
  useEffect(() => {
    const routes = ['/', '/gym', '/log', '/feed', '/sessions', '/leaderboards']
    const prefetchAll = () => routes.forEach((r) => router.prefetch(r))
    // Defer to idle time to avoid blocking initial paint
    // @ts-ignore
    const ric = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 400))
    const id = ric(prefetchAll)
    return () => {
      // No cancel needed for setTimeout; ignore for simplicity
    }
  }, [router])
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }
  const base = "py-3 px-2 rounded-lg transition-all duration-200 hover:bg-base-surface/50 active:scale-95 min-h-[44px] flex items-center justify-center"
  const active = "text-neon-purple font-semibold bg-neon-purple/10 shadow-sm"
  return (
    <div className="max-w-screen-md mx-auto px-3 py-3 grid grid-cols-6 gap-3 text-sm font-medium text-center text-base-subtext">
      <Link prefetch href="/" className={`${base} ${isActive('/') ? active : ''}`}>Home</Link>
      <Link prefetch href="/gym" className={`${base} ${isActive('/gym') ? active : ''}`}>Gyms</Link>
      <Link prefetch href="/log" className={`${base} ${isActive('/log') ? active : ''}`}>Log</Link>
      <Link prefetch href="/feed" className={`${base} ${isActive('/feed') ? active : ''}`}>Feed</Link>
      <Link prefetch href="/sessions" className={`${base} ${isActive('/sessions') ? active : ''}`}>Training</Link>
      <Link prefetch href="/leaderboards" className={`${base} ${isActive('/leaderboards') ? active : ''}`}>Leaders</Link>
    </div>
  )
}

