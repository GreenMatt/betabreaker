export default function LeaderboardsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Leaderboards</h1>
      <div className="card grid gap-2">
        <div className="flex gap-2 text-sm">
          <button className="btn-primary">Total Points</button>
          <button className="btn-primary">Most Climbs</button>
          <button className="btn-primary">Highest Grade</button>
        </div>
        <ul className="text-sm">
          <li className="py-1 border-b border-white/5">1. —</li>
          <li className="py-1 border-b border-white/5">2. —</li>
          <li className="py-1">3. —</li>
        </ul>
      </div>
    </div>
  )
}

