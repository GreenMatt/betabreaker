import AuthButtons from '@/components/AuthButtons'

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <div className="card">
        <h2 className="font-semibold mb-2">Account & Privacy</h2>
        <AuthButtons />
        <div className="mt-3 grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" /> Private profile
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" /> Notifications
          </label>
        </div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Gym Selection</h2>
        <select className="input">
          <option>— Select your gym —</option>
        </select>
      </div>
    </div>
  )
}

