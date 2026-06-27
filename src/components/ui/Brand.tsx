// Brand mark (gem.png) + the site-wide credit line. Used in the sidebar, login
// and the app footer so the identity is consistent everywhere.

import gem from '@/images/gem.png'
import { LinkedInLink } from '@/components/ui/LinkedInLink'

const AUTHOR_LINKEDIN = 'https://www.linkedin.com/in/aboulkacem-ben-arab-567974241/'

export function BrandMark({ size = 36, rounded = 'rounded-xl' }: { size?: number; rounded?: string }) {
  return (
    <img
      src={gem}
      alt="iGT"
      width={size}
      height={size}
      className={`${rounded} object-cover shadow-glow`}
      style={{ width: size, height: size }}
    />
  )
}

export function Credits({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-1.5 text-[11px] text-ink-mute ${className}`}>
      <span>Designed &amp; developed by <span className="text-ink-dim">Aboulkacem Ben Arab</span></span>
      <LinkedInLink url={AUTHOR_LINKEDIN} size={13} />
    </p>
  )
}
