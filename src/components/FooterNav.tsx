"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function FooterNav() {
  const pathname = usePathname() || '/'
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }
  const base = "py-3 px-2 rounded-lg transition-all duration-200 hover:bg-base-surface/50 active:scale-95 min-h-[44px] flex items-center justify-center"
  const active = "text-neon-purple font-semibold bg-neon-purple/10 shadow-sm"
  return (
    <div className="max-w-screen-md mx-auto px-3 py-3 grid grid-cols-6 gap-3 text-sm font-medium text-center text-base-subtext">
      <Link href="/" className={`${base} ${isActive('/') ? active : ''}`}>Home</Link>
      <Link href="/gym" className={`${base} ${isActive('/gym') ? active : ''}`}>Gyms</Link>
      <Link href="/log" className={`${base} ${isActive('/log') ? active : ''}`}>Log</Link>
      <Link href="/feed" className={`${base} ${isActive('/feed') ? active : ''}`}>Feed</Link>
      <Link href="/sessions" className={`${base} ${isActive('/sessions') ? active : ''}`}>Training</Link>
      <Link href="/leaderboards" className={`${base} ${isActive('/leaderboards') ? active : ''}`}>Leaders</Link>
    </div>
  )
}

