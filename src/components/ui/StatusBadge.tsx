import type { OpportunityStatus } from '@/data/types'
import { cn } from '@/lib/cn'

// Each pipeline stage gets a stable colour used by badges, the kanban, and dots.
export const STATUS_STYLE: Record<OpportunityStatus, { dot: string; text: string; bg: string }> = {
  Prospect: { dot: '#6b7795', text: '#a4afc6', bg: 'rgba(107,119,149,0.15)' },
  Contacted: { dot: '#60a5fa', text: '#93c5fd', bg: 'rgba(96,165,250,0.15)' },
  'Follow-up': { dot: '#22d3ee', text: '#67e8f9', bg: 'rgba(34,211,238,0.15)' },
  'Meeting scheduled': { dot: '#a78bfa', text: '#c4b5fd', bg: 'rgba(167,139,250,0.15)' },
  Negotiation: { dot: '#fbbf24', text: '#fcd34d', bg: 'rgba(251,191,36,0.15)' },
  'Contract sent': { dot: '#fb923c', text: '#fdba74', bg: 'rgba(251,146,60,0.15)' },
  'Contract signed': { dot: '#34d399', text: '#6ee7b7', bg: 'rgba(52,211,153,0.15)' },
  Lost: { dot: '#f87171', text: '#fca5a5', bg: 'rgba(248,113,113,0.15)' },
}

export function StatusBadge({ status, className }: { status: OpportunityStatus; className?: string }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={cn('chip', className)} style={{ background: s.bg, color: s.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  )
}

export function StatusDot({ status }: { status: OpportunityStatus }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[status].dot }} />
}
