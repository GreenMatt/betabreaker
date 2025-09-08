import '../styles/globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PWARegister } from '@/components/PWARegister'
// AppShell mounts client providers and guard
// @ts-expect-error Server Component including Client child
import AppShell from './AppShell'

export const metadata: Metadata = {
  title: 'BetaBreaker — Climbing Community PWA',
  description: 'Log climbs, train smarter, and compete with friends.',
  manifest: '/manifest.webmanifest'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/** PWA registration */}
        {/* @ts-expect-error Server Component including Client child */}
        <PWARegister />
        {/* @ts-expect-error Server Component including Client child */}
        <AppShell>{children}</AppShell>
        <footer className="fixed bottom-0 left-0 right-0 bg-base-panel/80 backdrop-blur border-t border-black/10">
          <div className="max-w-screen-md mx-auto px-4 py-2 grid grid-cols-5 gap-2 text-xs text-center text-base-subtext">
            <Link href="/" className="py-2">Home</Link>
            <Link href="/gym" className="py-2">Gyms</Link>
            <Link href="/log" className="py-2 text-neon-purple font-semibold">Log</Link>
            <Link href="/feed" className="py-2">Feed</Link>
            <Link href="/profile/me" className="py-2">Profile</Link>
          </div>
        </footer>
      </body>
    </html>
  )
}

