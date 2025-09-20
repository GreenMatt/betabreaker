export default function Loading() {
  return (
    <div className="max-w-screen-md mx-auto p-4 space-y-4">
      <div className="h-6 w-44 bg-white/10 rounded" />
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
        <div className="h-10 bg-white/10 rounded" />
      </div>
      <div className="card animate-pulse">
        <div className="h-48 bg-white/10 rounded" />
      </div>
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-2" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

