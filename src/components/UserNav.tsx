"use client"
import Link from 'next/link'
import { useAuth } from '@/lib/authContext'

export default function UserNav() {
  const { user, signOut } = useAuth()

  if (!user) {
    return (
      <div className="ml-auto flex items-center gap-3">
        <Link href="/login" className="btn-primary">Login</Link>
      </div>
    )
  }

  return (
    <div className="ml-auto flex items-center gap-3">
      <Link href="/profile/me" className="text-sm text-base-subtext">Profile</Link>
      <button className="btn-primary" onClick={signOut}>Sign out</button>
    </div>
  )
}
