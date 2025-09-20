// Server-rendered gym detail to avoid client auth bootstrap gaps
import { getServerSupabase } from '@/lib/supabaseServer'
import GymDetailClient from './GymDetailClient'

type Gym = { id: string; name: string; location: string | null; profile_photo: string | null }
type Climb = { id: string; name: string; grade: number | null; type: 'boulder' | 'top_rope' | 'lead'; location: string | null; setter: string | null; color: string | null; dyno: boolean | null; section_id: string | null; section?: { name: string } | null; community_grade?: number | null }
type Section = { id: string; name: string }

export default async function GymDetailPage({ params }: { params: { id: string } }) {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  const gid = params.id

  let gym: Gym | null = null
  let climbs: Climb[] = []
  let sections: Section[] = []
  let isAdmin = false
  let claimed = false
  let activity: any[] = []

  if (session?.user) {
    try {
      // Load gym, climbs, admin status, sections, and activity in parallel
      const [gRes, cRes, aRes, sRes, actRes, adminRes] = await Promise.all([
        supabase.from('gyms').select('id,name,location,profile_photo').eq('id', gid).maybeSingle(),
        supabase.from('climbs').select('id,name,grade,type,location,setter,color,dyno,section_id,active_status,section:gym_sections(name)').eq('gym_id', gid).order('created_at', { ascending: false }).limit(6),
        supabase.rpc('is_gym_admin', { gid }),
        supabase.from('gym_sections').select('id,name').eq('gym_id', gid).order('name', { ascending: true }),
        supabase.rpc('get_gym_activity', { gid, page_size: 6, page: 0 }),
        supabase.from('gym_admins').select('user_id').eq('gym_id', gid).limit(1)
      ])

      if (gRes.data) gym = gRes.data
      if (aRes.data) isAdmin = Boolean(aRes.data)
      if (sRes.data) sections = sRes.data
      if (actRes.data) activity = actRes.data || []
      if (adminRes.data) claimed = (adminRes.data || []).length > 0

      if (cRes.data) {
        const raw = (cRes.data || []) as any[]
        // Normalize section to object (not array) to match Climb type
        const list: Climb[] = raw.map((x: any) => ({
          id: x.id,
          name: x.name,
          grade: x.grade,
          type: x.type,
          location: x.location,
          setter: x.setter,
          color: x.color,
          dyno: x.dyno,
          section_id: x.section_id,
          section: Array.isArray(x.section)
            ? (x.section[0] ? { name: String(x.section[0]?.name ?? '') } : null)
            : (x.section ? { name: String(x.section?.name ?? '') } : null)
        }))
        climbs = list

        const ids = list.map((x: any) => x.id)

        // Load community ratings for climbs
        if (ids.length) {
          try {
            const { data: ratings } = await supabase
              .from('community_ratings')
              .select('climb_id, rating')
              .in('climb_id', ids)

            if (ratings) {
              const avgRatings: Record<string, number> = {}
              const ratingCounts: Record<string, number> = {}

              for (const r of ratings) {
                const cid = r.climb_id
                if (!avgRatings[cid]) {
                  avgRatings[cid] = 0
                  ratingCounts[cid] = 0
                }
                avgRatings[cid] += r.rating
                ratingCounts[cid] += 1
              }

              // Calculate averages and update climbs
              for (const cid in avgRatings) {
                avgRatings[cid] = Math.round((avgRatings[cid] / ratingCounts[cid]) * 10) / 10
              }

              climbs = climbs.map(climb => ({
                ...climb,
                community_grade: avgRatings[climb.id] || null
              }))
            }
          } catch (e) {
            console.error('Failed to load community ratings:', e)
          }
        }
      }
    } catch (e) {
      console.error('Failed to load gym data:', e)
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
    <GymDetailClient
      gymId={gid}
      initialGym={gym}
      initialClimbs={climbs}
      initialSections={sections}
      initialIsAdmin={isAdmin}
      initialClaimed={claimed}
      initialActivity={activity}
      currentUserId={session.user.id}
    />
  )
}








