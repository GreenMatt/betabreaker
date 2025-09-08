"use client"
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/authContext'

const PUBLIC_PATHS = new Set(['/login'])
const ADMIN_PATHS = new Set(['/admin'])

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const isPublic = PUBLIC_PATHS.has(pathname || '')
    if (!user && !isPublic) {
      router.replace('/login')
    } else if (user && isPublic) {
      router.replace('/')
    }
  }, [user, loading, pathname, router])

  const isPublic = PUBLIC_PATHS.has(pathname || '')

  // While resolving session
  if (loading && !(pathname && ADMIN_PATHS.has(pathname))) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="animate-pulse text-base-subtext">Loading…</div>
      </div>
    )
  }

  // If redirecting away, show a friendly placeholder instead of blank
  if (!user && !isPublic && !(pathname && ADMIN_PATHS.has(pathname))) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Redirecting to login…</div>
      </div>
    )
  }
  if (user && isPublic) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Redirecting…</div>
      </div>
    )
  }

  return <>{children}</>
}
