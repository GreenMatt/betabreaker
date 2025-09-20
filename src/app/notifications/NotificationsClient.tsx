"use client"
import Link from 'next/link'
import { useState } from 'react'

type Notification = {
  id: string
  type: 'bump' | 'comment'
  created_at: string
  read_at: string | null
  metadata: any
  actor?: { id: string, name: string | null, profile_photo: string | null } | null
}

export default function NotificationsClient({ initialItems }: { initialItems: Notification[] }) {
  const [items, setItems] = useState<Notification[]>(initialItems)
  const [marking, setMarking] = useState<string | null>(null)

  async function markAsRead(notificationId: string) {
    setMarking(notificationId)
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (!error) {
        setItems(prev => prev.map(item =>
          item.id === notificationId
            ? { ...item, read_at: new Date().toISOString() }
            : item
        ))
      }
    } catch (e) {
      console.error('Failed to mark notification as read:', e)
    } finally {
      setMarking(null)
    }
  }

  async function markAllAsRead() {
    const unreadIds = items.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return

    setMarking('all')
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)

      if (!error) {
        setItems(prev => prev.map(item =>
          unreadIds.includes(item.id)
            ? { ...item, read_at: new Date().toISOString() }
            : item
        ))
      }
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e)
    } finally {
      setMarking(null)
    }
  }

  const unreadCount = items.filter(n => !n.read_at).length
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              className="text-sm bg-white/10 hover:bg-white/20 rounded px-3 py-1"
              onClick={markAllAsRead}
              disabled={marking === 'all'}
            >
              {marking === 'all' ? 'Marking...' : 'Mark All Read'}
            </button>
          )}
          <Link href="/feed" className="btn-primary">Open Feed</Link>
        </div>
      </div>
      <div className="card">
        {items.length === 0 && (
          <div className="text-base-subtext">No notifications yet.</div>
        )}
        {items.length > 0 && (
          <div className="divide-y divide-white/5">
            {items.map(n => (
              <div key={n.id} className={`py-3 flex items-center gap-3 ${!n.read_at ? 'bg-blue-500/5 border-l-4 border-blue-500 pl-3' : ''}`}>
                {/* Unread indicator dot */}
                <div className="relative">
                  {!n.read_at && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-base-panel" />
                  )}
                  <img
                    src={n.actor?.profile_photo || '/icons/betabreaker_header.png'}
                    alt={n.actor?.name || 'User'}
                    className="h-10 w-10 rounded-full object-cover bg-white/10"
                  />
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${!n.read_at ? 'font-semibold' : ''}`}>
                    <span className="font-medium">{n.actor?.name || 'Someone'}</span>
                    {n.type === 'bump' && ' bumped your activity.'}
                    {n.type === 'comment' && ' commented on your activity:'}
                    {n.type === 'comment' && (n as any).metadata?.text && (
                      <span className="text-base-subtext"> {(n as any).metadata.text}</span>
                    )}
                  </div>
                  <div className="text-xs text-base-subtext">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!n.read_at && (
                    <button
                      className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded px-2 py-1"
                      onClick={() => markAsRead(n.id)}
                      disabled={marking === n.id}
                    >
                      {marking === n.id ? 'Marking...' : 'Mark Read'}
                    </button>
                  )}
                  <Link href="/feed" className="text-sm text-primary">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

