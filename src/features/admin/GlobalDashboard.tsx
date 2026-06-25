import { useMemo } from 'react'
import { Activity, CalendarCheck, Filter, Handshake, Send, Target, TrendingUp, Users } from 'lucide-react'
import { useDB } from '@/data/store'
import {
  conversions, funnel, goalProgress, kpis, performanceByLC, performanceByMember, timeline,
} from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Progress, SectionTitle, StatCard } from '@/components/ui/primitives'
import { Select } from '@/components/ui/Field'
import { ConversionBars, FunnelView, RankingBars, TimelineArea } from '@/components/charts/Charts'
import { useFilters } from '@/state/filters'

const METRIC_LABEL = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed' }

export default function GlobalDashboard() {
  const opportunities = useDB((s) => s.opportunities)
  const activities = useDB((s) => s.activities)
  const meetings = useDB((s) => s.meetings)
  const contracts = useDB((s) => s.contracts)
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const goals = useDB((s) => s.goals)

  const lcFilter = useFilters((s) => s.lcId)
  const setFilters = useFilters((s) => s.set)

  const d = useMemo(() => {
    const opps = lcFilter ? opportunities.filter((o) => o.lcId === lcFilter) : opportunities
    const oppIds = new Set(opps.map((o) => o.id))
    const acts = activities.filter((a) => oppIds.has(a.opportunityId))
    const mtgs = meetings.filter((m) => oppIds.has(m.opportunityId))
    const cons = contracts.filter((c) => oppIds.has(c.opportunityId))
    const scopedGoals = goals.filter((g) => (lcFilter ? g.scope === 'lc' && g.lcId === lcFilter : g.scope === 'global'))
    return {
      k: kpis(opps, acts, mtgs, cons),
      funnel: funnel(opps),
      conv: conversions(opps),
      byLC: performanceByLC(opps, acts, mtgs, lcs),
      byMember: performanceByMember(opps, acts, mtgs, users),
      tl: timeline(acts, mtgs, cons),
      goals: goalProgress(scopedGoals, acts, mtgs, opps),
    }
  }, [opportunities, activities, meetings, contracts, users, lcs, goals, lcFilter])

  return (
    <div>
      <PageHeader
        title="Global Dashboard"
        subtitle="All Local Committees · iGT sales performance"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-elev px-3">
            <Filter size={15} className="text-ink-mute" />
            <Select
              className="border-0 bg-transparent px-1 focus:ring-0"
              value={lcFilter ?? ''}
              onChange={(e) => setFilters({ lcId: e.target.value || null })}
            >
              <option value="">All LCs</option>
              {lcs.map((lc) => <option key={lc.id} value={lc.id}>{lc.name}</option>)}
            </Select>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Outreaches" value={fmtNum(d.k.outreaches)} icon={<Activity size={18} />} hint={`${fmtNum(d.k.opportunities)} opportunities`} />
        <StatCard label="Meetings" value={fmtNum(d.k.meetings)} icon={<CalendarCheck size={18} />} accent="var(--accent)" hint={`${fmtNum(d.k.active)} active in pipeline`} />
        <StatCard label="Contracts Signed" value={fmtNum(d.k.signed)} icon={<Handshake size={18} />} accent="var(--success)" hint={d.k.avgDaysToSign ? `~${d.k.avgDaysToSign}d to sign` : undefined} />
        <StatCard label="Conversion Rate" value={fmtPct(d.k.conversion, 1)} icon={<TrendingUp size={18} />} accent="var(--warning)" hint="signed / opportunities" />
      </div>

      {/* charts */}
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
          <SectionTitle title="Goal achievement" subtitle="Plan vs done · 2026 S1" />
          <div className="space-y-4">
            {d.goals.map((g) => (
              <div key={g.metric}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink-dim"><Target size={14} /> {METRIC_LABEL[g.metric]}</span>
                  <span className="text-ink-mute">{fmtNum(g.done)} / {fmtNum(g.planned)}</span>
                </div>
                <Progress value={g.pct} tone={g.pct >= 1 ? 'success' : g.pct >= 0.5 ? 'brand' : 'warning'} />
                <p className="mt-1 text-xs text-ink-mute">{fmtPct(g.pct)} achieved · gap {fmtNum(g.gap)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* rankings */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="LC ranking" subtitle="By total outreaches" action={<Users size={16} className="text-ink-mute" />} />
          <RankingBars data={d.byLC} dataKey="outreaches" color="var(--brand)" />
        </Card>
        <Card>
          <SectionTitle title="Top members" subtitle="By total outreaches" action={<Send size={16} className="text-ink-mute" />} />
          <RankingBars data={d.byMember} dataKey="outreaches" color="var(--accent)" />
        </Card>
      </div>
    </div>
  )
}
