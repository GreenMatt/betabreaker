// app/debug-auth/page.tsx
"use client"

import { useAuth } from '@/lib/authContext'
import { testDatabaseConnection, fetchUserStats, fetchBadges } from '@/lib/supabaseWrapper'
import { useState } from 'react'

export default function AuthDebugPage() {
  const { user, session, loading } = useAuth()
  const [testResults, setTestResults] = useState<any[]>([])

  const addTestResult = (test: string, result: any) => {
    setTestResults(prev => [...prev, {
      test,
      result,
      timestamp: new Date().toISOString()
    }])
  }

  const runTests = async () => {
    setTestResults([])

    // Test 1: Database connection
    try {
      const dbTest = await testDatabaseConnection()
      addTestResult('Database Connection', dbTest)
    } catch (error) {
      addTestResult('Database Connection', { error: String(error) })
    }

    // Test 2: User stats
    try {
      const stats = await fetchUserStats()
      addTestResult('User Stats', stats)
    } catch (error) {
      addTestResult('User Stats', { error: String(error) })
    }

    // Test 3: Badges
    try {
      const badges = await fetchBadges()
      addTestResult('Badges', { count: badges.length, badges: badges.slice(0, 3) })
    } catch (error) {
      addTestResult('Badges', { error: String(error) })
    }
  }

  const clearStorage = () => {
    if (typeof window !== 'undefined') {
      // Clear all supabase-related storage
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.includes('supabase')) {
          localStorage.removeItem(key)
          console.log('Removed localStorage key:', key)
        }
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i)
        if (key?.includes('supabase')) {
          sessionStorage.removeItem(key)
          console.log('Removed sessionStorage key:', key)
        }
      }
      window.location.reload()
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔍 Auth Diagnostics</h1>

      <div className="grid gap-6">
        {/* Auth Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Current Auth Status</h2>
          <div className="space-y-2 text-sm">
            <div>Loading: <span className={loading ? 'text-orange-600' : 'text-green-600'}>{String(loading)}</span></div>
            <div>Has User: <span className={user ? 'text-green-600' : 'text-red-600'}>{String(!!user)}</span></div>
            <div>Has Session: <span className={session ? 'text-green-600' : 'text-red-600'}>{String(!!session)}</span></div>
            {user && <div>User ID: <code>{user.id}</code></div>}
            {session && <div>Token Expires: <code>{new Date(session.expires_at! * 1000).toISOString()}</code></div>}
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Test Controls</h2>
          <div className="space-x-4">
            <button
              onClick={runTests}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Run Database Tests
            </button>
            <button
              onClick={() => (window as any).authMonitor?.test()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Run Auth Tests
            </button>
            <button
              onClick={() => (window as any).authMonitor?.storage()}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Inspect Storage
            </button>
            <button
              onClick={() => (window as any).authMonitor?.report()}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Print Report
            </button>
            <button
              onClick={clearStorage}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Clear Storage
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">Test Results</h2>
            <div className="space-y-3">
              {testResults.map((result, i) => (
                <div key={i} className="border-l-4 border-gray-300 pl-4">
                  <div className="font-medium">{result.test}</div>
                  <div className="text-xs text-gray-500">{result.timestamp}</div>
                  <pre className="text-xs bg-white p-2 mt-1 rounded overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">📋 Reproduction Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Open browser DevTools (Console tab)</li>
            <li>Sign in to your app via OAuth</li>
            <li>Come to this page and run the tests - they should work</li>
            <li>Leave the app open for 2+ minutes without interacting</li>
            <li>Come back and run the tests again</li>
            <li>Watch the console for auth state changes and errors</li>
            <li>Check if the tests start failing</li>
          </ol>

          <div className="mt-4 p-3 bg-white rounded border">
            <strong>Available in DevTools Console:</strong>
            <ul className="text-xs mt-1 space-y-1">
              <li><code>window.authMonitor.test()</code> - Test auth operations</li>
              <li><code>window.authMonitor.storage()</code> - Inspect browser storage</li>
              <li><code>window.authMonitor.report()</code> - Print diagnostics report</li>
              <li><code>window.authMonitor.diagnostics()</code> - Get raw data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}