"use client"
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function UploadButton({ bucket, pathPrefix, onUploaded }: { bucket: 'profile-photos' | 'climb-photos', pathPrefix: string, onUploaded?: (publicUrl: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick() {
    ref.current?.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const filename = `${pathPrefix}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from(bucket).upload(filename, file, { upsert: false })
    if (error) {
      alert(error.message)
    } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
      onUploaded?.(data.publicUrl)
    }
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button type="button" className="btn-primary" onClick={pick} disabled={busy}>{busy ? 'Uploading…' : 'Upload Photo'}</button>
    </>
  )
}

