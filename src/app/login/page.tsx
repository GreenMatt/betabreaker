"use client"
import AuthButtons from '@/components/AuthButtons'
import Logo from '@/components/Logo'

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          {/* @ts-expect-error Server Component including Client child */}
          <Logo size="lg" />
        </div>
        <h1 className="text-3xl font-bold mb-1">Sign in</h1>
        <p className="text-base-subtext mb-4">Welcome back. Use Google or email.</p>

        <div className="space-y-3">
          <AuthButtons />
        </div>

        <p className="mt-4 text-xs text-base-subtext">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
