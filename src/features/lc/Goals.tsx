import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useCurrentUser } from '@/state/session'
import { useDB } from '@/data/store'
import { goalProgress, outreachCount } from '@/lib/metrics'
import { goalContributorIds, manageableUsers } from '@/lib/rbac'
import { currentPeriod, inRange, operatingYear, periodLabel, periodRange } from '@/lib/dates'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import type { Goal, GoalMetric, User } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, Progress, SectionTitle } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { GoalCards } from '@/features/shared/GoalCards'
import { GoalEditorModal } from '@/features/shared/GoalEditor'

const METRICS: GoalMetric[] = ['outreaches', 'meetings', 'contracts', 'revenue']
const METRIC_LABEL: Record<GoalMetric, string> = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts', revenue: 'Revenue' }
const goalVal = (m: GoalMetric, n: number) => (m === 'revenue' ? fmtMoney(n) : fmtNum(n))

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
  const [period, setPeriod] = useState(() => currentPeriod('semester'))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const SEMESTERS = useMemo(() => { const y = operatingYear(); return [`${y}-S1`, `${y}-S2`] }, [])

  // "Done" window: the picked semester by default, narrowed if a date range is set.
  const win = useMemo(() => {
    const sem = periodRange('semester', period)
    return { from: from || sem.from, to: to || sem.to }
  }, [period, from, to])

  const managed = actor ? manageableUsers(actor, allUsers) : []
  // Section B (target table): the people this actor manages. LCPs set none but
  // still see their LC's LCVP targets (view only). Members/TLs without reports
  // see no table — just their own achievement above.
  const viewList: User[] = managed.length > 0
    ? managed
    : actor?.role === 'lcp'
      ? allUsers.filter((u) => u.role === 'lcvp' && u.lcId === actor.lcId)
      : []

  // Section A: the actor's OWN goal achievement for the selected semester only
  // (filtering by period fixes S1 and S2 cards showing at the same time).
  const myGoals = useMemo(() => {
    if (!actor) return []
    const isSem = (g: Goal) => (g.cadence ?? 'semester') === 'semester' && g.period === period
    let subjectGoals = allGoals.filter((g) => g.scope === 'member' && g.ownerId === actor.id && isSem(g))
    if (subjectGoals.length === 0 && actor.role === 'admin') subjectGoals = allGoals.filter((g) => g.scope === 'global' && isSem(g))
    if (subjectGoals.length === 0 && actor.role === 'lcp') subjectGoals = allGoals.filter((g) => g.scope === 'lc' && g.lcId === actor.lcId && isSem(g))
    if (subjectGoals.length === 0) return []
    const contributors = new Set(goalContributorIds(actor, allUsers))
    const opps = allOpps.filter((o) => contributors.has(o.ownerId))
    const ids = new Set(opps.map((o) => o.id))
    const acts = allActs.filter((a) => ids.has(a.opportunityId) && inRange(a.date, win.from, win.to))
    const mtgs = allMtgs.filter((m) => ids.has(m.opportunityId) && inRange(m.date, win.from, win.to))
    const oppsIn = opps.filter((o) => inRange(o.updatedAt, win.from, win.to))
    return goalProgress(subjectGoals, acts, mtgs, oppsIn)
  }, [actor, allGoals, allUsers, allOpps, allActs, allMtgs, period, win])

  const rows = useMemo(() => {
    return viewList.map((m) => {
      const ids = new Set(goalContributorIds(m, allUsers))
      const opps = allOpps.filter((o) => ids.has(o.ownerId))
      const oppIds = new Set(opps.map((o) => o.id))
      const acts = allActs.filter((a) => oppIds.has(a.opportunityId) && inRange(a.date, win.from, win.to))
      const mtgs = allMtgs.filter((mt) => oppIds.has(mt.opportunityId) && inRange(mt.date, win.from, win.to))
      const oppsIn = opps.filter((o) => inRange(o.updatedAt, win.from, win.to))
      const done: Record<GoalMetric, number> = {
        outreaches: outreachCount(acts, opps),
        meetings: mtgs.length,
        contracts: oppsIn.filter((o) => o.status === 'Contract signed').length,
        revenue: oppsIn.filter((o) => o.revenueReceived).reduce((s, o) => s + (o.value ?? 0), 0),
      }
      const cells = METRICS.map((metric) => {
        const planned = allGoals.find(
          (g) => g.ownerId === m.id && g.metric === metric && (g.cadence ?? 'semester') === 'semester' && g.period === period,
        )?.planned ?? 0
        return { metric, planned, done: done[metric], pct: planned ? done[metric] / planned : 0 }
      })
      return { user: m, cells }
    })
  }, [viewList, allUsers, allOpps, allActs, allMtgs, allGoals, period, win])

  const windowNote = from || to ? 'custom range' : periodLabel('semester', period)

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle={`${actor ? (SUBTITLE[actor.role] ?? 'Your targets') : 'Targets'} · ${periodLabel('semester', period)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-line bg-bg-elev p-1">
              {SEMESTERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${period === p ? 'bg-brand text-white' : 'text-ink-mute hover:text-ink'}`}
                >
                  {periodLabel('semester', p)}
                </button>
              ))}
            </div>
            <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            {managed.length > 0 && <Button onClick={() => setEditing(true)}><Target size={16} /> Set goals</Button>}
          </div>
        }
      />

      {/* Section A — the actor's own goal achievement */}
      <Card>
        <SectionTitle title="Your goal achievement" subtitle={`Planned vs. achieved · ${windowNote}`} />
        <GoalCards goals={myGoals} />
      </Card>

      {/* Section B — targets the actor manages (or LCVP targets for an LCP) */}
      {viewList.length > 0 && (
        <Card className="mt-4">
          <SectionTitle title="Target attainment" subtitle={`${SUBTITLE[actor?.role ?? ''] ?? 'Targets'} · ${windowNote}`} />
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
      )}

      {actor && managed.length > 0 && (
        <GoalEditorModal open={editing} onClose={() => setEditing(false)} actor={actor} users={managed} defaultPeriod={period} />
      )}
    </div>
  )
}
