// Shared performance dashboard — KPIs, funnel, conversion, timeline, goal
// progress and rankings. Used by the Admin Global Dashboard and the LC Overview;
// callers pass already-scoped data so the same component serves any altitude.

import { useMemo } from 'react'
import { Activity, CalendarCheck, Handshake, Target, TrendingUp } from 'lucide-react'
import {
  conversions, funnel, goalProgress, kpis, performanceByLC, performanceByMember, timeline,
} from '@/lib/metrics'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import { Card, Progress, SectionTitle, StatCard } from '@/components/ui/primitives'
import { ConversionBars, FunnelView, RankingBars, TimelineArea } from '@/components/charts/Charts'
import type { Activity as Act, Contract, Goal, GoalMetric, LocalCommittee, Meeting, Opportunity, User } from '@/data/types'

const METRIC_LABEL: Record<GoalMetric, string> = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed', revenue: 'Revenue received' }
const goalVal = (m: GoalMetric, n: number) => (m === 'revenue' ? fmtMoney(n) : fmtNum(n))

export interface DashboardProps {
  opps: Opportunity[]
  activities: Act[]
  meetings: Meeting[]
  contracts: Contract[]
  users: User[]
  lcs: LocalCommittee[]
  goals: Goal[]
  showLcRanking?: boolean
  goalSubtitle?: string
}

export function Dashboard({
  opps, activities, meetings, contracts, users, lcs, goals, showLcRanking, goalSubtitle = 'Plan vs done · 2026 S1',
}: DashboardProps) {
  const d = useMemo(() => ({
    k: kpis(opps, activities, meetings, contracts),
    funnel: funnel(opps),
    conv: conversions(opps),
    byLC: performanceByLC(opps, activities, meetings, lcs),
    byMember: performanceByMember(opps, activities, meetings, users),
    tl: timeline(activities, meetings, contracts),
    goals: goalProgress(goals, activities, meetings, opps),
  }), [opps, activities, meetings, contracts, users, lcs, goals])

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Outreaches" value={fmtNum(d.k.outreaches)} icon={<Activity size={18} />} hint={`${fmtNum(d.k.opportunities)} opportunities`} />
        <StatCard label="Meetings" value={fmtNum(d.k.meetings)} icon={<CalendarCheck size={18} />} accent="var(--accent)" hint={`${fmtNum(d.k.active)} active in pipeline`} />
        <StatCard label="Contracts Signed" value={fmtNum(d.k.signed)} icon={<Handshake size={18} />} accent="var(--success)" hint={d.k.avgDaysToSign ? `~${d.k.avgDaysToSign}d to sign` : undefined} />
        <StatCard label="Conversion Rate" value={fmtPct(d.k.conversion, 1)} icon={<TrendingUp size={18} />} accent="var(--warning)" hint="signed / opportunities" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Sales funnel" subtitle="Opportunities reaching each stage" />
          <FunnelView data={d.funnel} />
        </Card>
        <Card>
          <SectionTitle title="Stage conversion" subtitle="Drop-off between consecutive stages" />
          <ConversionBars data={d.conv} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Activity over time" subtitle="Monthly outreaches & meetings" />
          <TimelineArea data={d.tl} />
        </Card>
        <Card>
          <SectionTitle title="Goal achievement" subtitle={goalSubtitle} />
          <div className="space-y-4">
            {d.goals.length === 0 && <p className="text-sm text-ink-mute">No goals set.</p>}
            {d.goals.map((g) => (
              <div key={g.metric}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink-dim"><Target size={14} /> {METRIC_LABEL[g.metric]}</span>
                  <span className="text-ink-mute">{goalVal(g.metric, g.done)} / {goalVal(g.metric, g.planned)}</span>
                </div>
                <Progress value={g.pct} tone={g.pct >= 1 ? 'success' : g.pct >= 0.5 ? 'brand' : 'warning'} />
                <p className="mt-1 text-xs text-ink-mute">{fmtPct(g.pct)} achieved · gap {goalVal(g.metric, g.gap)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className={`mt-4 grid gap-4 ${showLcRanking ? 'lg:grid-cols-2' : ''}`}>
        {showLcRanking && (
          <Card>
            <SectionTitle title="LC ranking" subtitle="By total outreaches" />
            <RankingBars data={d.byLC} dataKey="outreaches" color="var(--brand)" />
          </Card>
        )}
        <Card>
          <SectionTitle title={showLcRanking ? 'Top members' : 'Member ranking'} subtitle="By total outreaches" />
          <RankingBars data={d.byMember} dataKey="outreaches" color="var(--accent)" />
        </Card>
      </div>
    </>
  )
}
