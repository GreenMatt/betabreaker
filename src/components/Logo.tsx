import Image from 'next/image'

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  // Designed for a horizontal wordmark (PNG/SVG) you placed at /public/icons/betabreaker_header.png
  const map = {
    sm: { w: 120, h: 30 },
    md: { w: 160, h: 40 },
    lg: { w: 220, h: 56 },
  } as const
  const { w, h } = map[size]
  return (
    <div className="flex items-center">
      <Image
        src="/icons/betabreaker_header.png"
        alt="BetaBreaker"
        width={w}
        height={h}
        priority
        style={{ height: h, width: w }}
      />
    </div>
  )
}
