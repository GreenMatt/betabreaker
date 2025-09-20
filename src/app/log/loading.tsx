export default function Loading() {
  return (
    <div className="max-w-screen-md mx-auto p-4 space-y-4">
      <div className="h-6 w-32 bg-white/10 rounded" />
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 bg-white/10 rounded" />
          <div className="h-10 bg-white/10 rounded" />
          <div className="h-10 bg-white/10 rounded col-span-2" />
        </div>
      </div>
    </div>
  )
}

