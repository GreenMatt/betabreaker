import AuthButtons from '@/components/AuthButtons'

export default function ProfilePage({ params }: { params: { id: string } }) {
  const id = params.id
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profile {id === 'me' ? '(You)' : `#${id}`}</h1>
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-full bg-white/10" />
          <div>
            <div className="font-semibold">Climber</div>
            <div className="text-xs text-base-subtext">Experience: â€”</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Auth</h2>
        <AuthButtons />
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Badges</h2>
        <p className="text-base-subtext">Earn badges by climbing and participating.</p>
      </div>
    </div>
  )
}


