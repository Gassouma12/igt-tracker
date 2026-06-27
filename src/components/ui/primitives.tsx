import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

// ---- Card ----------------------------------------------------------------
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card p-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---- Button --------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-[0_4px_16px_-6px_var(--brand-soft)]',
  secondary: 'bg-surface-2 text-ink hover:bg-line border border-line',
  ghost: 'text-ink-dim hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

export function Button({
  variant = 'primary', size = 'md', className, children, ...rest
}: { variant?: Variant; size?: Size } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---- Badge ---------------------------------------------------------------
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-dim',
    brand: 'bg-brand/15 text-brand',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
  }
  return <span className={cn('chip', tones[tone], className)}>{children}</span>
}

// ---- Avatar --------------------------------------------------------------
const AVATAR_HUES = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = AVATAR_HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length]
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${hue}, ${hue}99)` }}
    >
      {initials(name)}
    </span>
  )
}

// ---- Progress ------------------------------------------------------------
export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'success' | 'warning' }) {
  const colors = { brand: 'var(--brand)', success: 'var(--success)', warning: 'var(--warning)' }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value * 100, 100)}%`, background: colors[tone] }} />
    </div>
  )
}

// ---- ProgressRing --------------------------------------------------------
export function ProgressRing({ value, size = 72, stroke = 7, color = 'var(--brand)', label }: { value: number; size?: number; stroke?: number; color?: string; label?: ReactNode }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(value, 0), 1)
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      {label != null && <span className="absolute text-sm font-bold text-ink">{label}</span>}
    </div>
  )
}

// ---- StatCard ------------------------------------------------------------
export function StatCard({ label, value, hint, icon, accent = 'var(--brand)' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">{label}</p>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </Card>
  )
}

// ---- EmptyState ----------------------------------------------------------
export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-14 text-center">
      {icon && <div className="text-ink-mute">{icon}</div>}
      <p className="font-medium text-ink-dim">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-mute">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ---- Spinner -------------------------------------------------------------
export function Spinner() {
  return (
    <div className="grid place-items-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
    </div>
  )
}
