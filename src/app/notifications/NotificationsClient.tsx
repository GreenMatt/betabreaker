"use client"
import Link from 'next/link'

type Notification = {
  id: string
  type: 'bump' | 'comment'
  created_at: string
  read_at: string | null
  metadata: any
  actor?: { id: string, name: string | null, profile_photo: string | null } | null
}

export default function NotificationsClient({ initialItems }: { initialItems: Notification[] }) {
  const items = initialItems
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        <Link href="/feed" className="btn-primary">Open Feed</Link>
      </div>
      <div className="card">
        {items.length === 0 && (
          <div className="text-base-subtext">No notifications yet.</div>
        )}
        {items.length > 0 && (
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
                    {n.type === 'comment' && (n as any).metadata?.text && (
                      <span className="text-base-subtext"> {(n as any).metadata.text}</span>
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

