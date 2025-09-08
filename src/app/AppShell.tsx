"use client"
import Link from 'next/link'
import { AuthProvider } from '@/lib/authContext'
import RouteGuard from '@/components/RouteGuard'
import UserNav from '@/components/UserNav'
import Logo from '@/components/Logo'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RouteGuard>
        <div className="max-w-screen-md mx-auto px-4 pb-24">
          <header className="sticky top-0 z-20 backdrop-blur bg-base-bg/70 border-b border-black/10">
            <div className="flex items-center gap-3 py-3">
              <Link href="/" className="flex items-center gap-2">
                <Logo size="md" />
              </Link>
              <nav className="flex gap-3 text-sm text-base-subtext">
                <Link href="/gym">Gym</Link>
                <Link href="/log">Quick Log</Link>
                <Link href="/feed">Feed</Link>
                <Link href="/leaderboards">Leaders</Link>
                <Link href="/challenges">Challenges</Link>
                <Link href="/settings">Settings</Link>
              </nav>
              <UserNav />
            </div>
          </header>
          <main className="mt-4">{children}</main>
        </div>
      </RouteGuard>
    </AuthProvider>
  )
}
