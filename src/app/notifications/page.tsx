"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/authContext'

type Notification = {
  id: string
  type: 'bump' | 'comment'
  created_at: string
  read_at: string | null
  metadata: any
  actor?: { id: string, name: string | null, profile_photo: string | null } | null
}

export default function NotificationsPage() {
  const { user, authEpoch } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    if (!user) { setItems([]); setLoading(false); return }
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, type, created_at, read_at, metadata, actor:users!notifications_actor_id_fkey(id,name,profile_photo)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) throw error
        setItems((data || []) as any)
        // Automatically mark any unread as read when visiting
        if ((data || []).some((n: any) => !n.read_at)) {
          await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .is('read_at', null)
          // reflect locally
          setItems(prev => prev.map(i => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })))
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id, authEpoch])

  async function markAllRead() {
    if (!user) return
    setMarking(true)
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
      if (error) throw error
      setItems(prev => prev.map(i => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })))
    } catch (e) {
      console.error(e)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        <button className="btn-primary" disabled={marking || items.length === 0} onClick={markAllRead}>
          {marking ? 'Marking…' : 'Mark all as read'}
        </button>
      </div>
      <div className="card">
        {!user && <div className="text-base-subtext">Please sign in to view notifications.</div>}
        {user && loading && <div className="text-base-subtext">Loading…</div>}
        {user && !loading && items.length === 0 && (
          <div className="text-base-subtext">No notifications yet.</div>
        )}
        {user && !loading && items.length > 0 && (
          <div className="divide-y divide-white/5">
            {items.map(n => (
              <div key={n.id} className="py-3 flex items-center gap-3">
                <img
                  src={n.actor?.profile_photo || '/icons/betabreaker_header.png'}
                  alt={n.actor?.name || 'User'}
                  className="h-10 w-10 rounded-full object-cover bg-white/10"
                />
                <div className="flex-1">
                  <div className={`text-sm ${!n.read_at ? 'font-semibold' : ''}`}>
                    <span className="font-medium">{n.actor?.name || 'Someone'}</span>
                    {n.type === 'bump' && ' bumped your activity.'}
                    {n.type === 'comment' && ' commented on your activity:'}
                    {n.type === 'comment' && n.metadata?.text && (
                      <span className="text-base-subtext"> {String(n.metadata.text)}</span>
                    )}
                  </div>
                  <div className="text-xs text-base-subtext">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                <Link href="/feed" className="text-sm text-primary">View</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
