import { Suspense } from 'react'

export default function ClimbDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Climb #{id}</h1>
      <div className="grid gap-3">
        <div className="card">
          <h2 className="font-semibold mb-2">Photos</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="aspect-video bg-white/5 rounded" />
            <div className="aspect-video bg-white/5 rounded" />
            <div className="aspect-video bg-white/5 rounded" />
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-2">Community</h2>
          <p className="text-base-subtext">Ratings and comments appear here in real-time.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-2">Log this climb</h2>
          <Suspense fallback={<p>Loadingâ€¦</p>}>
            <form className="grid gap-2">
              <select className="input">
                <option>Flashed</option>
                <option>Sent</option>
                <option>Projected</option>
              </select>
              <input className="input" placeholder="Notes (optional)" />
              <button className="btn-primary">Log</button>
            </form>
          </Suspense>
        </div>
      </div>
    </div>
  )
}


