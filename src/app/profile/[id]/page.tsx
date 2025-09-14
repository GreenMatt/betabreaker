// Server-rendered profile to avoid client auth bootstrap gaps
import { getServerSupabase } from '@/lib/supabaseServer'
import ProfileClient from './ProfileClient'

type Profile = {
  id: string
  name: string | null
  profile_photo: string | null
  bio?: string | null
  route_setter?: boolean
}

type UserLite = { id: string, name: string | null, profile_photo: string | null }

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  const routeId = params.id
  const viewerId = session?.user?.id ?? null
  const targetId = routeId === 'me' ? viewerId : routeId

  let profile: Profile | null = null
  let badges: Array<{ id: string, name: string, icon: string | null, description?: string | null }> = []
  let following: UserLite[] = []
  let followers: UserLite[] = []

  if (targetId && session?.user) {
    try {
      // Load profile data
      const { data: profileData } = await supabase
        .from('users')
        .select('id,name,profile_photo,bio,route_setter')
        .eq('id', targetId)
        .maybeSingle()

      if (profileData) {
        profile = profileData as Profile
      } else {
        profile = { id: targetId, name: null, profile_photo: null, route_setter: false }
      }

      // Load badges
      const { data: badgeData } = await supabase
        .from('user_badges')
        .select('badge:badges(id,name,icon,description)')
        .eq('user_id', targetId)
      badges = (badgeData || []).map((r: any) => r.badge)

      // Load following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id, following:users!follows_following_id_fkey(id,name,profile_photo)')
        .eq('follower_id', targetId)
      following = (followingData || []).map((r: any) => r.following).filter(Boolean)

      // Load followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id, follower:users!follows_follower_id_fkey(id,name,profile_photo)')
        .eq('following_id', targetId)
      followers = (followersData || []).map((r: any) => r.follower).filter(Boolean)

    } catch (error) {
      console.error('Failed to load profile:', error)
    }
  }

  if (!session?.user) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Loading…</div>
      </div>
    )
  }

  return (
    <ProfileClient
      viewerId={viewerId}
      initialProfile={profile}
      initialBadges={badges}
      initialFollowing={following}
      initialFollowers={followers}
    />
  )
}

