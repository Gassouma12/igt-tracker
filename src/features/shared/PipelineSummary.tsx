// Numbers + charts view for a pipeline (already scoped/date-filtered by caller).
// Used by the member and LC pipeline pages as their "Summary" tab.

import { useMemo } from 'react'
import { Activity, CalendarCheck, Handshake, TrendingUp } from 'lucide-react'
import { funnel, kpis, statusDistribution, timeline, FUNNEL } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { Card, SectionTitle, StatCard } from '@/components/ui/primitives'
import { STATUS_STYLE } from '@/components/ui/StatusBadge'
import { FunnelView, TimelineArea } from '@/components/charts/Charts'
import type { Activity as Act, Contract, Meeting, Opportunity } from '@/data/types'

export function PipelineSummary({
  opps, activities, meetings, contracts,
}: {
  opps: Opportunity[]
  activities: Act[]
  meetings: Meeting[]
  contracts: Contract[]
}) {
  const d = useMemo(() => ({
    k: kpis(opps, activities, meetings, contracts),
    funnel: funnel(opps),
    tl: timeline(activities, meetings, contracts),
    dist: statusDistribution(opps),
  }), [opps, activities, meetings, contracts])

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outreaches" value={fmtNum(d.k.outreaches)} icon={<Activity size={18} />} hint={`${fmtNum(d.k.opportunities)} opportunities`} />
        <StatCard label="Meetings" value={fmtNum(d.k.meetings)} icon={<CalendarCheck size={18} />} accent="var(--accent)" hint={`${fmtNum(d.k.active)} active`} />
        <StatCard label="Signed" value={fmtNum(d.k.signed)} icon={<Handshake size={18} />} accent="var(--success)" />
        <StatCard label="Conversion" value={fmtPct(d.k.conversion, 1)} icon={<TrendingUp size={18} />} accent="var(--warning)" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Funnel" subtitle="Opportunities reaching each stage" />
          <FunnelView data={d.funnel} />
        </Card>
        <Card>
          <SectionTitle title="By stage" subtitle="Current distribution" />
          <div className="space-y-2.5 pt-1">
            {[...FUNNEL, 'Lost'].map((s) => {
              const n = d.dist[s as keyof typeof d.dist]
              const pct = d.k.opportunities ? n / d.k.opportunities : 0
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-ink-dim">{s}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: STATUS_STYLE[s as keyof typeof STATUS_STYLE].dot }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs text-ink-mute">{fmtNum(n)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle title="Activity over time" subtitle="Monthly outreaches & meetings" />
        <TimelineArea data={d.tl} />
      </Card>
    </div>
  )
}
