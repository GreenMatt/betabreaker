// lib/supabaseWrapper.ts
import { supabase } from '@/lib/supabaseClient'

// Optional thin helpers to standardize calls used around the app

export async function fetchUserStats(): Promise<{
  climbs: number; highest: number; badges: number; fas: number
}> {
  const { data, error } = await supabase.rpc('get_user_stats')
  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data
    return {
      climbs: row?.climb_count ?? 0,
      highest: row?.highest_grade ?? 0,
      badges: row?.badge_count ?? 0,
      fas: row?.fa_count ?? 0,
    }
  }
  // Fallback pattern can be used by pages if desired; kept simple here.
  return { climbs: 0, highest: 0, badges: 0, fas: 0 }
}

export async function fetchBadges() {
  const { data, error } = await supabase
    .from('badges')
    .select('id,name,icon,description')
    .order('name')
  if (error) return []
  return data ?? []
}
