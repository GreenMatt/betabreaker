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
  if (isInstagram(url)) {
    return <InstagramEmbed url={url} />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <div className="aspect-video w-full bg-white/5 grid place-items-center">
        <div className="text-center p-4">
          <div className="font-semibold">Open Video</div>
          <div className="text-xs text-base-subtext break-all">{url}</div>
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

function normalizeInstaPermalink(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('instagram.com')) return null
    // Keep only first 3 path segments to form permalink e.g. /p/{id}/ or /reel/{id}/
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const type = parts[0] // p | reel | tv
    const id = parts[1]
    return `https://www.instagram.com/${type}/${id}/`
  } catch { return null }
}

declare global { interface Window { instgrm?: any } }

function InstagramEmbed({ url }: { url: string }) {
  const permalink = normalizeInstaPermalink(url)
  if (!permalink) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <div className="aspect-video w-full bg-white/5 grid place-items-center">
          <div className="text-center p-4">
            <div className="font-semibold">Open Instagram Video</div>
            <div className="text-xs text-base-subtext break-all">{url}</div>
          </div>
        </div>
      </a>
    )
  }

  // Prefer Instagram's direct iframe embed to allow inline playback.
  // Example: https://www.instagram.com/reel/{id}/embed
  // Fallback to blockquote embed.js if iframe is blocked (account settings or private posts).
  const parts = new URL(permalink).pathname.split('/').filter(Boolean)
  const type = parts[0] // p | reel | tv
  const id = parts[1]
  const iframeSrc = `https://www.instagram.com/${type}/${id}/embed`
  const aspect = type === 'reel' ? '9 / 16' : '4 / 5'

  return (
    <div className="w-full">
      <div className="w-full bg-black" style={{ aspectRatio: aspect, borderRadius: 8, overflow: 'hidden' }}>
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="w-full h-full"
          title="Instagram"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="origin-when-cross-origin"
          style={{ border: 0 }}
        />
      </div>
      <div className="mt-2 text-right">
        <a href={permalink} target="_blank" rel="noreferrer" className="text-xs text-base-subtext hover:underline">
          Open on Instagram
        </a>
      </div>
    </div>
  )
}
