// Goal-achievement cards — a progress ring + done/target + remaining, used on
// the Performance page so "goals achieved" reads at a glance.

import { ProgressRing } from '@/components/ui/primitives'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import type { GoalProgress } from '@/lib/metrics'
import type { GoalMetric } from '@/data/types'

const LABEL: Record<GoalMetric, string> = {
  outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed', revenue: 'Revenue received',
}
const val = (m: GoalMetric, n: number) => (m === 'revenue' ? fmtMoney(n) : fmtNum(n))
const ringColor = (pct: number) => (pct >= 1 ? 'var(--success)' : pct >= 0.5 ? 'var(--brand)' : 'var(--warning)')

export function GoalCards({ goals }: { goals: GoalProgress[] }) {
  if (!goals.length) return <p className="text-sm text-ink-mute">No goals set for this selection yet.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {goals.map((g) => (
        <div key={g.metric} className="flex items-center gap-4 rounded-2xl border border-line bg-bg-elev p-4">
          <ProgressRing value={g.pct} color={ringColor(g.pct)} label={fmtPct(g.pct)} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-dim">{LABEL[g.metric] ?? g.metric}</p>
            <p className="mt-0.5 font-display text-lg font-bold text-ink">
              {val(g.metric, g.done)} <span className="text-sm font-normal text-ink-mute">/ {val(g.metric, g.planned)}</span>
            </p>
            <p className={`text-xs ${g.gap > 0 ? 'text-ink-mute' : 'text-success'}`}>
              {g.gap > 0 ? `${val(g.metric, g.gap)} to go` : 'Achieved 🎉'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
