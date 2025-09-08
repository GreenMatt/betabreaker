const KEY = 'betabreaker_pending_logs'

type PendingLog = {
  gym: string
  climb: string
  type: string
  difficulty: number
  attempt_type: string
  rating: number
  notes: string
  created_at: string
}

export async function savePendingLog(log: PendingLog) {
  const arr = getAll()
  arr.push(log)
  localStorage.setItem(KEY, JSON.stringify(arr))
}

function getAll(): PendingLog[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as PendingLog[]
  } catch {
    return []
  }
}

export async function replayPendingLogs() {
  const arr = getAll()
  if (arr.length === 0) return
  if (!navigator.onLine) return
  // TODO: Replace with Supabase batch insert to climb_logs
  // For now, we just clear after a pretend sync
  localStorage.removeItem(KEY)
}

