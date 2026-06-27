import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useLC } from './useLC'
import { useCurrentUser } from '@/state/session'
import { useDB } from '@/data/store'
import { goalProgress, revenue, totalOutreaches } from '@/lib/metrics'
import { manageableUsers } from '@/lib/rbac'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import type { GoalMetric } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, Progress, SectionTitle, StatCard } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { GoalEditorModal } from '@/features/shared/GoalEditor'

const METRIC_LABEL: Record<GoalMetric, string> = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed', revenue: 'Revenue received' }
const goalVal = (m: GoalMetric, n: number) => (m === 'revenue' ? fmtMoney(n) : fmtNum(n))

export default function Goals() {
  const actor = useCurrentUser()
  const allUsers = useDB((s) => s.users)
  const { lc, members, opportunities, activities, meetings, lcGoals, memberGoals } = useLC()
  const [editing, setEditing] = useState(false)

  const managed = actor ? manageableUsers(actor, allUsers) : []
  const lcProgress = useMemo(() => goalProgress(lcGoals, activities, meetings, opportunities), [lcGoals, activities, meetings, opportunities])
  const rev = useMemo(() => revenue(opportunities), [opportunities])

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
        received: revenue(myOpps).received, planRev: plannedFor(m.id, 'revenue'),
      }
    }).sort((a, b) => b.outPct - a.outPct)
  }, [members, opportunities, activities, meetings, memberGoals])

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle={`${lc?.name ?? 'LC'} targets · 2026 S1`}
        actions={managed.length > 0 && <Button onClick={() => setEditing(true)}><Target size={16} /> Set goals</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {lcProgress.map((g) => (
          <StatCard
            key={g.metric}
            label={METRIC_LABEL[g.metric]}
            value={`${goalVal(g.metric, g.done)} / ${goalVal(g.metric, g.planned)}`}
            icon={<Target size={18} />}
            accent={g.pct >= 1 ? 'var(--success)' : g.pct >= 0.5 ? 'var(--brand)' : 'var(--warning)'}
            hint={`${fmtPct(g.pct)} achieved · gap ${goalVal(g.metric, g.gap)}`}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <StatCard label="Revenue received" value={fmtMoney(rev.received)} accent="var(--success)" hint="collected this semester" />
        <StatCard label="Receivable (outstanding)" value={fmtMoney(rev.receivable)} accent="var(--warning)" hint="signed, awaiting payment" />
      </div>

      <Card className="mt-4">
        <SectionTitle title="Member goal progress" subtitle="Per-member target attainment" />
        <Table>
          <THead><TR><TH>Member</TH><TH>Outreaches</TH><TH className="w-36">Progress</TH><TH>Meetings</TH><TH>Contracts</TH><TH>Revenue</TH></TR></THead>
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
                <TD>{fmtMoney(r.received)} / {fmtMoney(r.planRev)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {actor && <GoalEditorModal open={editing} onClose={() => setEditing(false)} actor={actor} users={managed} />}
    </div>
  )
}
