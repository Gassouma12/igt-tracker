import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useCurrentUser } from '@/state/session'
import { useDB } from '@/data/store'
import { actualFor } from '@/lib/metrics'
import { goalContributorIds, manageableUsers } from '@/lib/rbac'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import type { GoalMetric, User } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, Progress, SectionTitle } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { GoalEditorModal } from '@/features/shared/GoalEditor'

const METRICS: GoalMetric[] = ['outreaches', 'meetings', 'contracts', 'revenue']
const METRIC_LABEL: Record<GoalMetric, string> = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts', revenue: 'Revenue' }
const goalVal = (m: GoalMetric, n: number) => (m === 'revenue' ? fmtMoney(n) : fmtNum(n))

// Who this role sets/sees goals for, phrased for the page subtitle.
const SUBTITLE: Record<string, string> = {
  admin: 'Targets you set for each LCVP',
  lcvp: 'Targets you set for your team leaders',
  team_leader: 'Targets you set for your members',
  lcp: 'Your LC’s LCVP targets (view only)',
}

export default function Goals() {
  const actor = useCurrentUser()
  const allUsers = useDB((s) => s.users)
  const allOpps = useDB((s) => s.opportunities)
  const allActs = useDB((s) => s.activities)
  const allMtgs = useDB((s) => s.meetings)
  const allGoals = useDB((s) => s.goals)
  const [editing, setEditing] = useState(false)

  const managed = actor ? manageableUsers(actor, allUsers) : []
  // LCPs set no goals but still see the goals set for their LC's LCVPs.
  const viewList: User[] = managed.length > 0
    ? managed
    : allUsers.filter((u) => u.role === 'lcvp' && u.lcId === actor?.lcId)

  const rows = useMemo(() => viewList.map((m) => {
    const ids = new Set(goalContributorIds(m, allUsers))
    const opps = allOpps.filter((o) => ids.has(o.ownerId))
    const oppIds = new Set(opps.map((o) => o.id))
    const acts = allActs.filter((a) => oppIds.has(a.opportunityId))
    const mtgs = allMtgs.filter((mt) => oppIds.has(mt.opportunityId))
    const cells = METRICS.map((metric) => {
      const planned = allGoals.find(
        (g) => g.ownerId === m.id && g.metric === metric && (g.cadence ?? 'semester') === 'semester',
      )?.planned ?? 0
      const done = actualFor(metric, acts, mtgs, opps)
      return { metric, planned, done, pct: planned ? done / planned : 0 }
    })
    return { user: m, cells }
  }), [viewList, allUsers, allOpps, allActs, allMtgs, allGoals])

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle={`${actor ? (SUBTITLE[actor.role] ?? 'Targets') : 'Targets'} · 2026 S1`}
        actions={managed.length > 0 && <Button onClick={() => setEditing(true)}><Target size={16} /> Set goals</Button>}
      />

      <Card>
        <SectionTitle title="Target attainment" subtitle="Planned vs. achieved this semester" />
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-mute">No one to show goals for yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                {METRICS.map((m) => <TH key={m}>{METRIC_LABEL[m]}</TH>)}
                <TH className="w-32">Outreach progress</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(({ user, cells }) => (
                <TR key={user.id}>
                  <TD className="font-medium text-ink">{user.name}</TD>
                  {cells.map((c) => (
                    <TD key={c.metric}>{goalVal(c.metric, c.done)} / {goalVal(c.metric, c.planned)}</TD>
                  ))}
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={cells[0].pct} tone={cells[0].pct >= 1 ? 'success' : cells[0].pct >= 0.5 ? 'brand' : 'warning'} />
                      <span className="w-10 shrink-0 text-right text-xs text-ink-mute">{fmtPct(cells[0].pct)}</span>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {actor && managed.length > 0 && (
        <GoalEditorModal open={editing} onClose={() => setEditing(false)} actor={actor} users={managed} />
      )}
    </div>
  )
}
