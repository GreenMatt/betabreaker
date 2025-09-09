"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function FooterNav() {
  const pathname = usePathname() || '/'
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }
  const base = "py-2"
  const active = "text-neon-purple font-semibold"
  return (
    <div className="max-w-screen-md mx-auto px-4 py-2 grid grid-cols-5 gap-2 text-xs text-center text-base-subtext">
      <Link href="/" className={`${base} ${isActive('/') ? active : ''}`}>Home</Link>
      <Link href="/gym" className={`${base} ${isActive('/gym') ? active : ''}`}>Gyms</Link>
      <Link href="/log" className={`${base} ${isActive('/log') ? active : ''}`}>Log</Link>
      <Link href="/feed" className={`${base} ${isActive('/feed') ? active : ''}`}>Feed</Link>
      <Link href="/profile/me" className={`${base} ${isActive('/profile') ? active : ''}`}>Profile</Link>
    </div>
  )
}

