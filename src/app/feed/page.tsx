import FeedClient from './FeedClient'
import { getServerSupabase } from '@/lib/supabaseServer'

export default async function FeedPage() {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  let initialMe: any[] = []
  let initialFollowing: any[] = []
  if (session?.user) {
    const { data } = await supabase
      .from('climb_logs')
      .select('id, date, attempt_type, attempts, personal_rating, notes, climb_id, climb:climbs(name, grade, type, color, gym:gyms(name)), user:users(profile_photo)')
      .order('date', { ascending: false })
      .range(0, 5)
    initialMe = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.date,
      attempt_type: r.attempt_type,
      attempts: r.attempts,
      personal_rating: r.personal_rating,
      notes: r.notes,
      climb_id: r.climb_id,
      climb: r.climb,
      user: r.user || null,
    }))
    const { data: followingData } = await supabase.rpc('get_following_logs', { page_size: 6, page: 0 })
    initialFollowing = (followingData as any[] || []).map((r: any) => ({
      id: String(r.id),
      created_at: r.created_at,
      attempt_type: r.attempt_type,
      attempts: r.attempts,
      personal_rating: r.personal_rating,
      notes: r.notes,
      user_id: String(r.user_id),
      climb_id: String(r.climb_id),
      climb_name: r.climb_name,
      gym_name: r.gym_name,
      grade: r.grade,
      type: r.type,
      color: r.color,
      user_name: r.user_name,
      profile_photo: r.profile_photo,
      bump_count: r.bump_count || 0,
      bumped: Boolean(r.bumped),
    }))
  }
  return <FeedClient initialUserId={session?.user?.id ?? null} initialMe={initialMe as any} initialFollowing={initialFollowing as any} />
}
