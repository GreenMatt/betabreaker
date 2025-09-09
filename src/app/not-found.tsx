export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-base-subtext">The page you’re looking for doesn’t exist.</p>
        <div className="mt-2">
          <Link href="/" className="btn-primary">Go home</Link>
        </div>
      </div>
    </div>
  )
}

