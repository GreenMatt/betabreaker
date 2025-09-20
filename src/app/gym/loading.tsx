export default function Loading() {
  return (
    <div className="max-w-screen-md mx-auto p-4 space-y-4">
      <div className="h-6 w-48 bg-white/10 rounded" />
      <div className="grid gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-white/10 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}

