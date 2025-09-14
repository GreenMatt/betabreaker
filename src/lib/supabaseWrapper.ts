// lib/supabaseWrapper.ts
import { supabase } from '@/lib/supabaseClient'

// Optional thin helpers to standardize calls used around the app

function logDatabaseError(operation: string, error: any) {
  console.error(`🔥 Database Error [${operation}]:`, {
    message: error.message,
    code: error.code,
    hint: error.hint,
    details: error.details,
    timestamp: new Date().toISOString()
  })

  // Check for auth-related errors
  if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
    console.warn('🚨 This looks like an auth/session error!')
  }
}

export async function fetchUserStats(): Promise<{
  climbs: number; highest: number; badges: number; fas: number
}> {
  console.log('📊 Fetching user stats...')

  const { data, error } = await supabase.rpc('get_user_stats')

  if (error) {
    logDatabaseError('fetchUserStats', error)
    return { climbs: 0, highest: 0, badges: 0, fas: 0 }
  }

  if (data) {
    const row = Array.isArray(data) ? data[0] : data
    const stats = {
      climbs: row?.climb_count ?? 0,
      highest: row?.highest_grade ?? 0,
      badges: row?.badge_count ?? 0,
      fas: row?.fa_count ?? 0,
    }
    console.log('✅ User stats fetched:', stats)
    return stats
  }

  console.log('⚠️ No stats data returned')
  return { climbs: 0, highest: 0, badges: 0, fas: 0 }
}

export async function fetchBadges() {
  console.log('🏅 Fetching badges...')

  const { data, error } = await supabase
    .from('badges')
    .select('id,name,icon,description')
    .order('name')

  if (error) {
    logDatabaseError('fetchBadges', error)
    return []
  }

  console.log(`✅ Fetched ${data?.length || 0} badges`)
  return data ?? []
}

// Test function to verify auth is working
export async function testDatabaseConnection() {
  console.log('🧪 Testing database connection...')

  try {
    // Test basic query
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (testError) {
      logDatabaseError('testConnection', testError)
      return { success: false, error: testError.message }
    }

    console.log('✅ Database connection successful')
    return { success: true, recordCount: testData?.length || 0 }
  } catch (error) {
    console.error('💥 Database connection test failed:', error)
    return { success: false, error: String(error) }
  }
}
