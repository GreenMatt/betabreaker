"use client"
import React from 'react'

export function VideoAddForm({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = React.useState('')
  return (
    <div className="flex items-center gap-2 mt-2">
      <input className="input flex-1" placeholder="Paste Instagram, YouTube, or TikTok link" value={url} onChange={e => setUrl(e.target.value)} />
      <button className="btn-primary" onClick={() => { if (url.trim()) { onAdd(url.trim()); setUrl('') } }}>Add</button>
    </div>
  )
}

export function VideoPreview({ url }: { url: string }) {
  const yt = matchYouTube(url)
  if (yt) {
    return (
      <div className="aspect-video w-full bg-black">
        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`} title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      </div>
    )
  }
  const ig = isInstagram(url)
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <div className="aspect-video w-full bg-white/5 grid place-items-center">
        <div className="text-center p-4">
          <div className="font-semibold">Open Video</div>
          <div className="text-xs text-base-subtext break-all">{url}</div>
          {ig && <div className="mt-1 text-xs text-base-subtext">Instagram videos open in a new tab</div>}
        </div>
      </div>
    </a>
  )
}

export function matchYouTube(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/embed\/([^/?#]+)/)
      if (m) return m[1]
    }
    if (u.hostname === 'youtu.be') return u.pathname.slice(1)
  } catch {}
  return null
}

export function isInstagram(url: string): boolean {
  try { return new URL(url).hostname.includes('instagram.com') } catch { return false }
}

export function isSupportedVideoUrl(url: string): boolean {
  return !!matchYouTube(url) || isInstagram(url)
}
