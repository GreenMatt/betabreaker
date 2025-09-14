// Server-rendered climb detail to avoid client auth bootstrap gaps
import { getServerSupabase } from '@/lib/supabaseServer'
import ClimbDetailClient from './ClimbDetailClient'

type Climb = { id: string; name: string; grade: number | null; type: 'boulder'|'top_rope'|'lead'; color: string | null; dyno: boolean | null; gym: { id: string, name: string }; community_grade?: number | null }

interface ClimbDetailPageProps {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function ClimbDetailPage({ params, searchParams }: ClimbDetailPageProps) {
  const { id } = params
  const openLog = searchParams?.log === '1'
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  let climb: Climb | null = null
  let photos: Array<{ id: string, image_base64: string | null }> = []
  let videos: Array<{ id: string, url: string, user_id?: string | null }> = []
  let comments: any[] = []
  let sends: Array<{ user_id: string, user_name: string | null, date: string, attempt_type: 'flashed'|'sent', fa?: boolean }> = []
  let isAdmin = false
  let isRouteSetter = false

  if (session?.user) {
    try {
      // Load climb data
      const { data: c } = await supabase
        .from('climbs')
        .select('id,name,grade,type,color,dyno,gym:gyms(id,name)')
        .eq('id', id)
        .maybeSingle()

      if (c) {
        climb = c as any

        // Load community rating for this climb
        try {
          const { data: ratings } = await supabase
            .from('community_ratings')
            .select('rating')
            .eq('climb_id', id)

          if (ratings && ratings.length > 0) {
            const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            const communityGrade = Math.round(avg * 10) / 10
            climb = { ...climb, community_grade: communityGrade }
          }
        } catch (e) {
          console.error('Failed to load community rating:', e)
        }

        // Check admin status
        if (c.gym?.id) {
          const { data: ok } = await supabase.rpc('is_gym_admin', { gid: c.gym.id })
          isAdmin = !!ok
        }

        // Check if current user is a route setter
        const { data: userData } = await supabase
          .from('users')
          .select('route_setter')
          .eq('id', session.user.id)
          .maybeSingle()
        isRouteSetter = !!userData?.route_setter

        // Load photos
        const { data: ph } = await supabase
          .from('climb_photos')
          .select('id,image_base64')
          .eq('climb_id', id)
          .order('created_at', { ascending: false })
          .limit(12)
        photos = ph || []

        // Load videos (optional; ignore error if table not present)
        try {
          const { data: vids } = await supabase
            .from('climb_videos')
            .select('id,url,user_id')
            .eq('climb_id', id)
            .order('created_at', { ascending: false })
          videos = vids || []
        } catch {
          videos = []
        }

        // Load comments
        const { data: cm } = await supabase
          .from('climb_comments')
          .select('id, user_id, parent_id, body, is_setter, created_at, user:users(name,profile_photo,route_setter)')
          .eq('climb_id', id)
          .order('created_at', { ascending: true })
        comments = cm || []

        // Load sends (flashed or sent) for this climb, earliest first
        const { data: sl } = await supabase
          .from('climb_logs')
          .select('user_id, date, attempt_type, user:users(name)')
          .eq('climb_id', id)
          .in('attempt_type', ['flashed','sent'])
          .order('date', { ascending: true })

        let mapped = (sl || []).map((r: any) => ({
          user_id: r.user_id as string,
          user_name: r.user?.name || null,
          date: r.date as string,
          attempt_type: r.attempt_type as 'flashed' | 'sent',
          fa: false
        }))

        // Fallback: if RLS limits visibility, augment via gym activity RPC
        try {
          const gid = c.gym?.id as string | undefined
          if (gid) {
            const { data: act } = await supabase.rpc('get_gym_activity', { gid, page_size: 200, page: 0 })
            const extras = (act as any[] | null | undefined)?.filter((row: any) => {
              const isSend = row?.attempt_type === 'flashed' || row?.attempt_type === 'sent'
              const matchById = row?.climb_id ? String(row.climb_id) === String(id) : false
              const matchByName = !matchById && row?.climb_name && (row.climb_name === c?.name)
              return isSend && (matchById || matchByName)
            }).map((row: any) => ({
              user_id: String(row.user_id || ''),
              user_name: row.user_name || null,
              date: String(row.created_at || row.date || new Date().toISOString()),
              attempt_type: (row.attempt_type === 'flashed' ? 'flashed' : 'sent') as 'flashed' | 'sent',
              fa: false
            })) || []

            // Merge unique by user_id+date
            const key = (x: any) => `${x.user_id}|${x.date}`
            const map: Record<string, any> = {}
            for (const r of [...mapped, ...extras]) map[key(r)] = r
            mapped = Object.values(map).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          }
        } catch {
          /* noop if RPC not available */
        }

        if (mapped.length) mapped[0].fa = true
        sends = mapped
      }
    } catch (e) {
      console.error('Failed to load climb data:', e)
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
    <ClimbDetailClient
      climbId={id}
      initialClimb={climb}
      initialPhotos={photos}
      initialVideos={videos}
      initialComments={comments}
      initialSends={sends}
      initialIsAdmin={isAdmin}
      initialIsRouteSetter={isRouteSetter}
      currentUserId={session.user.id}
      openLog={openLog}
    />
  )
}






