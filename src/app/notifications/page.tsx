import NotificationsClient from './NotificationsClient'
import { getServerSupabase } from '@/lib/supabaseServer'

export default async function NotificationsPage() {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-base-subtext">Please sign in to view notifications.</div>
      </div>
    )
  }
  const { data } = await supabase
    .from('notifications')
    .select('id, type, created_at, read_at, metadata, actor:users!notifications_actor_id_fkey(id,name,profile_photo)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  return <NotificationsClient initialItems={(data || []) as any} />
}
