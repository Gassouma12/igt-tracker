import { useMemo } from 'react'
import { Activity, CalendarCheck, Handshake, Target, TrendingUp } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { funnel, goalProgress, kpis, timeline } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Progress, SectionTitle, StatCard } from '@/components/ui/primitives'
import { FunnelView, TimelineArea } from '@/components/charts/Charts'

const METRIC_LABEL = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed' }

export default function Performance() {
  const user = useCurrentUser()
  const { opportunities, activities, meetings, contracts } = useScopedData()
  const goals = useDB((s) => s.goals)

  const d = useMemo(() => {
    const myGoals = goals.filter((g) => g.scope === 'member' && g.ownerId === user?.id)
    return {
      k: kpis(opportunities, activities, meetings, contracts),
      funnel: funnel(opportunities),
      tl: timeline(activities, meetings, contracts),
      goals: goalProgress(myGoals, activities, meetings, opportunities),
    }
  }, [opportunities, activities, meetings, contracts, goals, user])

  return (
    <div>
      <PageHeader title="My Performance" subtitle="Your personal iGT sales metrics · 2026 S1" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outreaches" value={fmtNum(d.k.outreaches)} icon={<Activity size={18} />} hint={`${fmtNum(d.k.opportunities)} opportunities`} />
        <StatCard label="Meetings" value={fmtNum(d.k.meetings)} icon={<CalendarCheck size={18} />} accent="var(--accent)" hint={`${fmtNum(d.k.active)} active`} />
        <StatCard label="Signed" value={fmtNum(d.k.signed)} icon={<Handshake size={18} />} accent="var(--success)" />
        <StatCard label="Conversion" value={fmtPct(d.k.conversion, 1)} icon={<TrendingUp size={18} />} accent="var(--warning)" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="My funnel" subtitle="Opportunities reaching each stage" />
          <FunnelView data={d.funnel} />
        </Card>
        <Card>
          <SectionTitle title="Goal progress" subtitle="Personal targets vs done" />
          <div className="space-y-4">
            {d.goals.length === 0 && <p className="text-sm text-ink-mute">No goals assigned.</p>}
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

      <Card className="mt-4">
        <SectionTitle title="Activity over time" subtitle="Your monthly outreaches & meetings" />
        <TimelineArea data={d.tl} />
      </Card>
    </div>
  )
}
