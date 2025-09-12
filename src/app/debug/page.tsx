"use client"
import { useAuth } from '@/lib/authContext'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DebugPage() {
  const { user, session, loading } = useAuth()
  const [output, setOutput] = useState<string[]>([])
  const [testing, setTesting] = useState(false)

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setOutput(prev => [...prev, logMessage])
  }

  const clearOutput = () => {
    setOutput([])
  }

  const testDatabaseConnectivity = async () => {
    setTesting(true)
    clearOutput()
    
    log('=== DATABASE CONNECTIVITY TEST ===')
    
    try {
      // Test 1: Current session
      log('1. Testing current session...')
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        log(`❌ Session error: ${sessionError.message}`)
        setTesting(false)
        return
      }
      
      if (!sessionData?.session) {
        log('❌ No active session - please sign in first!')
        setTesting(false)
        return
      }
      
      log(`✅ Session OK - User: ${sessionData.session.user.email}`)
      log(`   User ID: ${sessionData.session.user.id}`)
      log(`   Session expires: ${new Date(sessionData.session.expires_at! * 1000).toLocaleString()}`)
      
      // Test 2: Basic connection test
      log('2. Testing basic Supabase connection...')
      try {
        const { data: basicTest, error: basicError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .limit(1)
        
        if (basicError) {
          log(`❌ Basic connection failed: ${basicError.message}`)
        } else {
          log(`✅ Basic connection OK - Found ${basicTest?.length || 0} public tables`)
        }
      } catch (e: any) {
        log(`❌ Basic connection error: ${e.message}`)
      }
      
      // Test 3: Users table
      log('3. Testing users table...')
      try {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, name')
          .limit(3)
        
        if (usersError) {
          log(`❌ Users table error: ${usersError.message}`)
          log(`   Code: ${usersError.code}`)
          log(`   Details: ${usersError.details}`)
          log(`   Hint: ${usersError.hint}`)
        } else {
          log(`✅ Users table OK - Found ${usersData?.length || 0} records`)
          if (usersData && usersData.length > 0) {
            log(`   Sample user: ${JSON.stringify(usersData[0])}`)
          }
        }
      } catch (e: any) {
        log(`❌ Users table exception: ${e.message}`)
      }
      
      // Test 4: Current user profile
      log('4. Testing current user profile...')
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .single()
        
        if (profileError) {
          log(`❌ Profile query error: ${profileError.message}`)
          log(`   Code: ${profileError.code}`)
        } else if (profileData) {
          log(`✅ Profile found: ${JSON.stringify(profileData)}`)
        } else {
          log(`⚠️ Profile exists but no data returned`)
        }
      } catch (e: any) {
        log(`❌ Profile query exception: ${e.message}`)
      }
      
      // Test 5: Badges table
      log('5. Testing badges table...')
      try {
        const { data: badgesData, error: badgesError } = await supabase
          .from('badges')
          .select('id, name, description')
          .limit(5)
        
        if (badgesError) {
          log(`❌ Badges table error: ${badgesError.message}`)
          log(`   Code: ${badgesError.code}`)
          log(`   Details: ${badgesError.details}`)
        } else {
          log(`✅ Badges table OK - Found ${badgesData?.length || 0} records`)
          if (badgesData && badgesData.length > 0) {
            log(`   Sample badge: ${JSON.stringify(badgesData[0])}`)
          }
        }
      } catch (e: any) {
        log(`❌ Badges table exception: ${e.message}`)
      }
      
      // Test 6: Climb_logs table
      log('6. Testing climb_logs table...')
      try {
        const { data: logsData, error: logsError } = await supabase
          .from('climb_logs')
          .select('id, user_id, date')
          .eq('user_id', sessionData.session.user.id)
          .limit(3)
        
        if (logsError) {
          log(`❌ Climb_logs table error: ${logsError.message}`)
          log(`   Code: ${logsError.code}`)
        } else {
          log(`✅ Climb_logs table OK - Found ${logsData?.length || 0} user records`)
          if (logsData && logsData.length > 0) {
            log(`   Sample log: ${JSON.stringify(logsData[0])}`)
          }
        }
      } catch (e: any) {
        log(`❌ Climb_logs table exception: ${e.message}`)
      }
      
      // Test 7: User_badges table
      log('7. Testing user_badges table...')
      try {
        const { data: userBadgesData, error: userBadgesError } = await supabase
          .from('user_badges')
          .select('user_id, badge_id, earned_date')
          .eq('user_id', sessionData.session.user.id)
          .limit(3)
        
        if (userBadgesError) {
          log(`❌ User_badges table error: ${userBadgesError.message}`)
          log(`   Code: ${userBadgesError.code}`)
        } else {
          log(`✅ User_badges table OK - Found ${userBadgesData?.length || 0} user records`)
          if (userBadgesData && userBadgesData.length > 0) {
            log(`   Sample badge: ${JSON.stringify(userBadgesData[0])}`)
          }
        }
      } catch (e: any) {
        log(`❌ User_badges table exception: ${e.message}`)
      }
      
      // Test 8: RPC function
      log('8. Testing get_user_stats RPC function...')
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_stats')
        
        if (rpcError) {
          log(`❌ RPC function error: ${rpcError.message}`)
          log(`   Code: ${rpcError.code}`)
          log(`   Details: ${rpcError.details}`)
          log(`   Hint: ${rpcError.hint}`)
        } else {
          log(`✅ RPC function OK - Data: ${JSON.stringify(rpcData)}`)
        }
      } catch (e: any) {
        log(`❌ RPC function exception: ${e.message}`)
      }
      
      // Test 9: Count queries (what the app actually uses)
      log('9. Testing count queries...')
      try {
        const { count: climbCount, error: climbCountError } = await supabase
          .from('climb_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', sessionData.session.user.id)
        
        if (climbCountError) {
          log(`❌ Climb count error: ${climbCountError.message}`)
        } else {
          log(`✅ Climb count OK - Count: ${climbCount}`)
        }
        
        const { count: badgeCount, error: badgeCountError } = await supabase
          .from('user_badges')
          .select('user_id', { count: 'exact', head: true })
          .eq('user_id', sessionData.session.user.id)
        
        if (badgeCountError) {
          log(`❌ Badge count error: ${badgeCountError.message}`)
        } else {
          log(`✅ Badge count OK - Count: ${badgeCount}`)
        }
      } catch (e: any) {
        log(`❌ Count queries exception: ${e.message}`)
      }
      
      log('=== TEST COMPLETE ===')
      
    } catch (error: any) {
      log(`❌ Unexpected test error: ${error.message}`)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading auth...</div>
  }

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Database Debug</h1>
        <p>Please sign in first to test database connectivity.</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Database Debug & Connectivity Test</h1>
      <div className="mb-4 text-sm text-gray-600">
        <p><strong>Version:</strong> v0.1.0-debug</p>
        <p><strong>Git Commit:</strong> d55061d</p>
        <p><strong>Last Updated:</strong> {new Date('2025-09-12T20:15:00').toLocaleString()}</p>
        <p><strong>Page Load:</strong> {new Date().toLocaleString()}</p>
        <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
      </div>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Auth Status:</h2>
        <p><strong>User:</strong> {user.email}</p>
        <p><strong>User ID:</strong> {user.id}</p>
        <p><strong>Session:</strong> {session ? 'Active' : 'None'}</p>
      </div>
      
      <div className="mb-4">
        <button 
          onClick={testDatabaseConnectivity}
          disabled={testing}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 mr-2"
        >
          {testing ? 'Testing...' : 'Run Database Tests'}
        </button>
        
        <button 
          onClick={clearOutput}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Clear Output
        </button>
      </div>
      
      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
        {output.length === 0 ? (
          <div className="text-gray-500">Click "Run Database Tests" to start testing...</div>
        ) : (
          output.map((line, index) => (
            <div key={index} className="mb-1">{line}</div>
          ))
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Note:</strong> This page tests all database tables and functions used by the app.</p>
        <p>Look for ❌ errors to identify what's preventing data from loading.</p>
      </div>
    </div>
  )
}