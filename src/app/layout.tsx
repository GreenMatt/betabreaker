import '../styles/globals.css'
import Link from 'next/link'
// @ts-expect-error Client Footer in Server layout
import FooterNav from '@/components/FooterNav'
import type { Metadata } from 'next'
import { PWARegister } from '@/components/PWARegister'
// AppShell mounts client providers and guard
// @ts-expect-error Server Component including Client child
import AppShell from './AppShell'

// Default runtime; allow Next-on-Pages to choose per route

export const metadata: Metadata = {
  title: 'BetaBreaker — Climbing Community PWA',
  description: 'Log climbs, train smarter, and compete with friends.',
  manifest: '/manifest.webmanifest',\n  icons: {\n    icon: '/icons/favicon.ico'\n  }
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
          <FooterNav />
        </footer>
      </body>
    </html>
  )
}


