// Small presentation helpers — no domain logic here.

export function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

export function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `€${n.toLocaleString('en-US')}`
}

export function fmtPct(ratio: number, digits = 0): string {
  if (!isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtMonth(key: string): string {
  // 'YYYY-MM' -> 'Mon YYYY'
  const [y, m] = key.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function relativeDays(d: string | null | undefined): string {
  if (!d) return '—'
  const days = Math.round((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.round(days / 30)}mo ago`
  return `${Math.round(days / 365)}y ago`
}

export function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
