export default function Loading() {
  return (
    <div className="max-w-screen-md mx-auto p-4 space-y-4">
      <div className="h-6 w-56 bg-white/10 rounded" />
      <div className="grid gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card animate-pulse h-14" />
        ))}
      </div>
    </div>
  )
}

