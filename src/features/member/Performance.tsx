import { useMemo, useState } from 'react'
import { Activity, CalendarCheck, Handshake, Target, TrendingUp } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { funnel, goalProgress, kpis, timeline } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { availableMonths, inMonthRange } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Progress, SectionTitle, StatCard } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/Dropdown'
import { MonthRange } from '@/components/ui/MonthRange'
import { FunnelView, TimelineArea } from '@/components/charts/Charts'

const METRIC_LABEL: Record<string, string> = { outreaches: 'Outreaches', meetings: 'Meetings', contracts: 'Contracts signed' }

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

  const selectedGoals = useMemo(() => {
    if (memberId) return goals.filter((g) => g.scope === 'member' && g.ownerId === memberId)
    if (lcId) return goals.filter((g) => g.scope === 'lc' && g.lcId === lcId)
    if (user?.role === 'member') return goals.filter((g) => g.scope === 'member' && g.ownerId === user.id)
    if (user?.role === 'lcp' || user?.role === 'lcvp') return goals.filter((g) => g.scope === 'lc' && g.lcId === user.lcId)
    return goals.filter((g) => g.scope === 'global')
  }, [goals, memberId, lcId, user])

  const goalsWithActuals = useMemo(
    () => goalProgress(selectedGoals, sel.acts, sel.mtgs, sel.opps),
    [selectedGoals, sel],
  )

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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Funnel" subtitle="Opportunities reaching each stage" />
          <FunnelView data={sel.funnel} />
        </Card>
        <Card>
          <SectionTitle title="Goal progress" subtitle="Targets vs done" />
          <div className="space-y-4">
            {goalsWithActuals.length === 0 && <p className="text-sm text-ink-mute">No goals for this selection.</p>}
            {goalsWithActuals.map((g) => (
              <div key={g.metric}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink-dim"><Target size={14} /> {METRIC_LABEL[g.metric] ?? g.metric}</span>
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
        <SectionTitle title="Activity over time" subtitle="Monthly outreaches & meetings" />
        <TimelineArea data={sel.tl} />
      </Card>
    </div>
  )
}
