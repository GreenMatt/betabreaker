"use client"
import Link from 'next/link'
import { AuthProvider } from '@/lib/authContext'
import { BadgeAwardProvider } from '@/contexts/BadgeAwardContext'
import RouteGuard from '@/components/RouteGuard'
import ErrorBoundary from '@/components/ErrorBoundary'
import UserNav from '@/components/UserNav'
import Logo from '@/components/Logo'
import Stabilizer from '@/components/Stabilizer'
import { usePageVisibility } from '@/lib/usePageVisibility'

export default function AppShell({ children }: { children: React.ReactNode }) {
  // Proactively refresh session after returning from background (5+ mins)
  usePageVisibility()

  return (
    <AuthProvider>
      <BadgeAwardProvider>
        <Stabilizer />
        <RouteGuard>
          <ErrorBoundary>
          <div className="max-w-screen-md mx-auto px-4 pb-24">
          <header className="sticky top-0 z-20 backdrop-blur bg-base-bg/70 border-b border-black/10">
            <div className="flex items-center gap-3 py-3 flex-wrap justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Logo size="md" />
              </Link>
              <nav className="hidden md:flex gap-3 text-sm text-base-subtext">
                <Link href="/gym">Gym</Link>
                <Link href="/log">Quick Log</Link>
                <Link href="/feed">Feed</Link>
                <Link href="/leaderboards">Leaders</Link>
                <Link href="/sessions">Training</Link>
                <Link href="/settings">Settings</Link>
              </nav>
              <UserNav />
            </div>
          </header>
          <main className="mt-4">{children}</main>
        </div>
        </ErrorBoundary>
      </RouteGuard>
      </BadgeAwardProvider>
    </AuthProvider>
  )
}


