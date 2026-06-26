import { useMemo } from 'react'
import { Target } from 'lucide-react'
import { useLC } from './useLC'
import { goalProgress, totalOutreaches } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Progress, SectionTitle, StatCard } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'

const METRIC_LABEL = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed' }

export default function Goals() {
  const { lc, members, opportunities, activities, meetings, lcGoals, memberGoals } = useLC()

  const lcProgress = useMemo(
    () => goalProgress(lcGoals, activities, meetings, opportunities),
    [lcGoals, activities, meetings, opportunities],
  )

  const memberRows = useMemo(() => {
    const plannedFor = (ownerId: string, metric: string) =>
      memberGoals.find((g) => g.ownerId === ownerId && g.metric === metric)?.planned ?? 0
    return members.map((m) => {
      const myOpps = opportunities.filter((o) => o.ownerId === m.id)
      const myOppIds = new Set(myOpps.map((o) => o.id))
      const out = totalOutreaches(activities.filter((a) => myOppIds.has(a.opportunityId)))
      const mtg = meetings.filter((mt) => myOppIds.has(mt.opportunityId)).length
      const signed = myOpps.filter((o) => o.status === 'Contract signed').length
      const planOut = plannedFor(m.id, 'outreaches')
      return {
        id: m.id, name: m.name,
        out, planOut, outPct: planOut ? out / planOut : 0,
        mtg, planMtg: plannedFor(m.id, 'meetings'),
        signed, planCon: plannedFor(m.id, 'contracts'),
      }
    }).sort((a, b) => b.outPct - a.outPct)
  }, [members, opportunities, activities, meetings, memberGoals])

  return (
    <div>
      <PageHeader title="Goals" subtitle={`${lc?.name ?? 'LC'} targets · 2026 S1`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {lcProgress.map((g) => (
          <StatCard
            key={g.metric}
            label={METRIC_LABEL[g.metric]}
            value={`${fmtNum(g.done)} / ${fmtNum(g.planned)}`}
            icon={<Target size={18} />}
            accent={g.pct >= 1 ? 'var(--success)' : g.pct >= 0.5 ? 'var(--brand)' : 'var(--warning)'}
            hint={`${fmtPct(g.pct)} achieved · gap ${fmtNum(g.gap)}`}
          />
        ))}
      </div>

      <Card className="mt-4">
        <SectionTitle title="Member goal progress" subtitle="Outreach target attainment per member" />
        <Table>
          <THead><TR><TH>Member</TH><TH>Outreaches</TH><TH className="w-40">Progress</TH><TH>Meetings</TH><TH>Contracts</TH></TR></THead>
          <TBody>
            {memberRows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-ink">{r.name}</TD>
                <TD>{fmtNum(r.out)} / {fmtNum(r.planOut)}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Progress value={r.outPct} tone={r.outPct >= 1 ? 'success' : r.outPct >= 0.5 ? 'brand' : 'warning'} />
                    <span className="w-10 shrink-0 text-right text-xs text-ink-mute">{fmtPct(r.outPct)}</span>
                  </div>
                </TD>
                <TD>{fmtNum(r.mtg)} / {fmtNum(r.planMtg)}</TD>
                <TD>{fmtNum(r.signed)} / {fmtNum(r.planCon)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  )
}
