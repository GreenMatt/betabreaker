// Server-rendered sessions to avoid client auth bootstrap gaps
import { getServerSupabase } from '@/lib/supabaseServer'
import SessionsClient from './SessionsClient'

// Helper to get YYYY-MM-DD in local time (no timezone conversion)
function toLocalYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type Session = {
  id: string
  date: string
  duration_mins: number | null
  activity_type: 'Climb' | 'Board' | 'Hang' | 'Strength' | 'Cardio' | 'Yoga' | 'Boulder' | 'Top Rope' | 'Lead' | 'Strength Training' | 'Other'
  notes: string | null
  feeling: 'bad' | 'good' | 'great' | null
}

interface SessionsPageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  const today = new Date()
  const year = searchParams?.year ? parseInt(searchParams.year as string) : today.getFullYear()
  const month = searchParams?.month ? parseInt(searchParams.month as string) : today.getMonth()

  let items: Session[] = []

  if (session?.user) {
    try {
      const monthStartYMD = toLocalYMD(new Date(year, month, 1))
      const monthEndYMD = toLocalYMD(new Date(year, month + 1, 0))
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, date, duration_mins, activity_type, notes, feeling')
        .eq('user_id', session.user.id)
        .gte('date', monthStartYMD)
        .lte('date', monthEndYMD)
        .order('date', { ascending: false })
        .limit(5)

      if (error) throw error
      items = (data || []) as any
    } catch (error) {
      console.error('Failed to load sessions:', error)
      items = []
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
    <SessionsClient
      initialItems={items}
      userId={session.user.id}
      initialYear={year}
      initialMonth={month}
    />
  )
}






