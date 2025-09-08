"use client"
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/authContext'

export default function AuthButtons() {
  const [email, setEmail] = useState('')
  const { user, loading, error, signInWith, signInEmail, signOut } = useAuth()
  useEffect(() => { /* Auth state via context */ }, [])
  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    await signInEmail(email)
    if (!error) alert('Check your email for a magic link')
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-base-subtext">Signed in</span>
        <button className="btn-primary" onClick={signOut}>Sign out</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <button className="w-full rounded-lg border border-black/10 bg-white text-base-text px-4 py-2 hover:bg-black/5 flex items-center justify-center gap-2" disabled={loading} onClick={() => signInWith('google')}>
          <span>Sign in with Google</span>
        </button>
        <button className="w-full rounded-lg border border-black/10 bg-white text-base-text px-4 py-2 hover:bg-black/5 flex items-center justify-center gap-2" disabled={loading} onClick={() => signInWith('facebook')}>
          <span>Sign in with Facebook</span>
        </button>
      </div>
      <div className="text-center text-xs text-base-subtext">or sign in with e‑mail</div>
      <form onSubmit={onEmailSubmit} className="grid gap-2">
        <input className="input w-full" type="email" placeholder="Email for magic link" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn-primary w-full" disabled={loading || !email} type="submit">Email Link</button>
      </form>
      {error && <div className="text-sm text-red-400">{error}</div>}
    </div>
  )
}
