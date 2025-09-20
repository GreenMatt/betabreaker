import { getServerSupabase } from '@/lib/supabaseServer'
import GymClient from './GymClient'

export default async function GymPage() {
  const supabase = getServerSupabase()
  const { data } = await supabase
    .from('gyms')
    .select('id,name,location,profile_photo')
    .order('created_at', { ascending: true })
  return <GymClient initialGyms={(data || []) as any} />
}
