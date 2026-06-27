import { useMemo, useState } from 'react'
import { Activity, CalendarCheck, Handshake, TrendingUp } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { funnel, goalProgress, kpis, revenue, timeline } from '@/lib/metrics'
import { goalContributorIds } from '@/lib/rbac'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import { availableMonths, inMonthRange } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, SectionTitle, StatCard } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/Dropdown'
import { MonthRange } from '@/components/ui/MonthRange'
import { GoalCards } from '@/features/shared/GoalCards'
import { FunnelView, TimelineArea } from '@/components/charts/Charts'

export default function Performance() {
  const user = useCurrentUser()
  const { opportunities, activities, meetings, contracts } = useScopedData()
  const allUsers = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const goals = useDB((s) => s.goals)

  const [lcId, setLcId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const showLc = user?.role === 'admin'
  const showMember = user?.role !== 'member'
  const months = useMemo(() => availableMonths(activities.map((a) => a.date)), [activities])

  // members that actually own opportunities in the current scope (optionally an LC)
  const memberOptions = useMemo(() => {
    const owners = new Set(opportunities.map((o) => o.ownerId))
    return allUsers
      .filter((u) => owners.has(u.id) && (!lcId || u.lcId === lcId))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [opportunities, allUsers, lcId])

  const sel = useMemo(() => {
    let opps = opportunities
    if (lcId) opps = opps.filter((o) => o.lcId === lcId)
    if (memberId) opps = opps.filter((o) => o.ownerId === memberId)
    const ids = new Set(opps.map((o) => o.id))
    const dated = (date: string | null | undefined) => !from && !to ? true : inMonthRange(date, from, to)
    const acts = activities.filter((a) => ids.has(a.opportunityId) && dated(a.date))
    const mtgs = meetings.filter((m) => ids.has(m.opportunityId) && dated(m.date))
    const cons = contracts.filter((c) => ids.has(c.opportunityId))
    const oppsInRange = (!from && !to) ? opps : opps.filter((o) => dated(o.lastActivityAt) || dated(o.createdAt))
    return {
      opps: oppsInRange, acts, mtgs, cons,
      k: kpis(oppsInRange, acts, mtgs, cons),
      funnel: funnel(oppsInRange),
      tl: timeline(acts, mtgs, cons),
    }
  }, [opportunities, activities, meetings, contracts, lcId, memberId, from, to])

  // Goals are computed against the *contributor* set, not the viewing filter:
  // a member's goal counts only themselves; an LCVP's goal aggregates their own
  // + their team's numbers (rbac.goalContributorIds).
  const goalCtx = useMemo(() => {
    if (lcId && !memberId) {
      return {
        subjectGoals: goals.filter((g) => g.scope === 'lc' && g.lcId === lcId),
        contributors: new Set(allUsers.filter((u) => u.lcId === lcId).map((u) => u.id)),
      }
    }
    const subject = allUsers.find((u) => u.id === (memberId || user?.id))
    if (!subject) return { subjectGoals: [], contributors: new Set<string>() }
    let subjectGoals = goals.filter((g) => g.scope === 'member' && g.ownerId === subject.id)
    if (subjectGoals.length === 0 && subject.role === 'admin') subjectGoals = goals.filter((g) => g.scope === 'global')
    if (subjectGoals.length === 0 && subject.role === 'lcp') subjectGoals = goals.filter((g) => g.scope === 'lc' && g.lcId === subject.lcId)
    return { subjectGoals, contributors: new Set(goalContributorIds(subject, allUsers)) }
  }, [goals, memberId, lcId, user, allUsers])

  const goalsWithActuals = useMemo(() => {
    const { subjectGoals, contributors } = goalCtx
    const noRange = !from && !to
    const dated = (d: string | null | undefined) => noRange || inMonthRange(d, from, to)
    const opps = opportunities.filter((o) => contributors.has(o.ownerId) && (noRange || dated(o.lastActivityAt) || dated(o.createdAt)))
    const ids = new Set(opps.map((o) => o.id))
    const acts = activities.filter((a) => ids.has(a.opportunityId) && dated(a.date))
    const mtgs = meetings.filter((m) => ids.has(m.opportunityId) && dated(m.date))
    return goalProgress(subjectGoals, acts, mtgs, opps)
  }, [goalCtx, opportunities, activities, meetings, from, to])

  const who = memberId ? memberOptions.find((m) => m.id === memberId)?.name
    : lcId ? lcs.find((l) => l.id === lcId)?.name
      : user?.role === 'member' ? 'You' : 'All in scope'

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle={`${who} · 2026 S1`}
        actions={
          <>
            <MonthRange months={months} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            {showLc && (
              <Dropdown
                className="w-40"
                value={lcId}
                onChange={(v) => { setLcId(v); setMemberId('') }}
                options={[{ value: '', label: 'All LCs' }, ...lcs.map((l) => ({ value: l.id, label: l.name }))]}
              />
            )}
            {showMember && (
              <Dropdown
                className="w-44"
                value={memberId}
                onChange={setMemberId}
                options={[{ value: '', label: 'All members' }, ...memberOptions.map((m) => ({ value: m.id, label: m.name }))]}
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outreaches" value={fmtNum(sel.k.outreaches)} icon={<Activity size={18} />} hint={`${fmtNum(sel.k.opportunities)} opportunities`} />
        <StatCard label="Meetings" value={fmtNum(sel.k.meetings)} icon={<CalendarCheck size={18} />} accent="var(--accent)" hint={`${fmtNum(sel.k.active)} active`} />
        <StatCard label="Signed" value={fmtNum(sel.k.signed)} icon={<Handshake size={18} />} accent="var(--success)" />
        <StatCard label="Conversion" value={fmtPct(sel.k.conversion, 1)} icon={<TrendingUp size={18} />} accent="var(--warning)" />
      </div>

      <Card className="mt-4">
        <SectionTitle
          title="Goal achievement"
          subtitle={`Targets vs done · ${who}${user?.role === 'lcvp' && !memberId && !lcId ? ' (you + your team)' : ''}`}
        />
        <GoalCards goals={goalsWithActuals} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Funnel" subtitle="Opportunities reaching each stage" />
          <FunnelView data={sel.funnel} />
        </Card>
        <Card>
          <SectionTitle title="Revenue" subtitle="Pipeline value for this selection" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
              <p className="text-xs text-ink-mute">Received</p>
              <p className="mt-1 font-display text-2xl font-bold text-success">{fmtMoney(revenue(sel.opps).received)}</p>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs text-ink-mute">Receivable (outstanding)</p>
              <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtMoney(revenue(sel.opps).receivable)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle title="Activity over time" subtitle="Monthly outreaches & meetings" />
        <TimelineArea data={sel.tl} />
      </Card>
    </div>
  )
}
