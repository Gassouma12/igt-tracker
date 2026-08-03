import { useMemo, useState } from 'react'
import { Activity, CalendarCheck, Handshake, TrendingUp } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { conversions, funnel, keyConversions, kpis, pipelineValue, receivablesByMonth, revenue, timeline, todayLocal } from '@/lib/metrics'
import { fmtMoney, fmtMonth, fmtNum, fmtPct } from '@/lib/format'
import { inRange } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Card, SectionTitle, StatCard } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/Dropdown'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { Modal } from '@/components/ui/Modal'
import { ConversionBars, ConversionStats, FunnelView, TimelineArea } from '@/components/charts/Charts'

type Drill = 'outreaches' | 'meetings' | 'signed'
const shortDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function Performance() {
  const user = useCurrentUser()
  const { opportunities, activities, meetings, contracts } = useScopedData()
  const allUsers = useDB((s) => s.users)
  const companies = useDB((s) => s.companies)
  const lcs = useDB((s) => s.localCommittees)

  const [lcId, setLcId] = useState('')
  const [teamId, setTeamId] = useState('') // team leader id (LCVP: filter by team)
  const [memberId, setMemberId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [drill, setDrill] = useState<Drill | null>(null)

  const showLc = user?.role === 'admin'
  const showTeam = user?.role === 'lcvp'
  const showMember = user?.role !== 'member'
  // The LCVP's teams (one per team leader in their LC).
  const teamOptions = useMemo(
    () => allUsers.filter((u) => u.role === 'team_leader' && u.lcId === user?.lcId).sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers, user],
  )
  // Owner ids that make up the selected team (the leader + their members).
  const teamOwners = useMemo(
    () => (teamId ? new Set<string>([teamId, ...allUsers.filter((u) => u.teamLeadId === teamId).map((u) => u.id)]) : null),
    [teamId, allUsers],
  )
  // members that actually own opportunities in the current scope (optionally an LC / team)
  const memberOptions = useMemo(() => {
    const owners = new Set(opportunities.map((o) => o.ownerId))
    return allUsers
      .filter((u) => owners.has(u.id) && (!lcId || u.lcId === lcId) && (!teamOwners || teamOwners.has(u.id)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [opportunities, allUsers, lcId, teamOwners])

  const sel = useMemo(() => {
    let opps = opportunities
    if (lcId) opps = opps.filter((o) => o.lcId === lcId)
    if (teamOwners) opps = opps.filter((o) => teamOwners.has(o.ownerId))
    if (memberId) opps = opps.filter((o) => o.ownerId === memberId)
    const ids = new Set(opps.map((o) => o.id))
    const dated = (date: string | null | undefined) => !from && !to ? true : inRange(date, from, to)
    const acts = activities.filter((a) => ids.has(a.opportunityId) && dated(a.date))
    const mtgs = meetings.filter((m) => ids.has(m.opportunityId) && dated(m.date))
    const cons = contracts.filter((c) => ids.has(c.opportunityId))
    const oppsInRange = (!from && !to) ? opps : opps.filter((o) => dated(o.lastActivityAt) || dated(o.createdAt))
    return {
      opps: oppsInRange, acts, mtgs, cons,
      k: kpis(oppsInRange, acts, mtgs, cons),
      funnel: funnel(oppsInRange),
      conv: conversions(oppsInRange),
      keyConv: keyConversions(oppsInRange),
      tl: timeline(acts, mtgs, cons, oppsInRange),
      rev: revenue(oppsInRange),
      pipe: pipelineValue(oppsInRange),
    }
  }, [opportunities, activities, meetings, contracts, lcId, teamOwners, memberId, from, to])

  // Row lists behind the clickable KPIs — recomputed with the same scope + date
  // filter, so the modal always matches the number on the card.
  const drillData = useMemo(() => {
    const coName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
    const uName = (id: string) => allUsers.find((u) => u.id === id)?.name ?? '—'
    const oppById = new Map(sel.opps.map((o) => [o.id, o]))       // matches KPI window
    const oppByIdAll = new Map(opportunities.map((o) => [o.id, o])) // for name lookups
    const byCompany = new Map<string, { company: string; owner: string; touches: number; last: string | null }>()
    for (const a of sel.acts) {
      const o = oppById.get(a.opportunityId)
      if (!o) continue
      const cur = byCompany.get(o.companyId) ?? { company: coName(o.companyId), owner: uName(o.ownerId), touches: 0, last: null }
      cur.touches++
      if (a.date && (!cur.last || a.date > cur.last)) cur.last = a.date
      byCompany.set(o.companyId, cur)
    }
    const today = todayLocal()
    return {
      outreaches: [...byCompany.values()].sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '')),
      meetings: sel.mtgs
        .filter((m) => !m.date || m.date <= today) // "had" — mirrors the KPI (past/undated)
        .map((m) => { const o = oppByIdAll.get(m.opportunityId); return { company: o ? coName(o.companyId) : '—', owner: o ? uName(o.ownerId) : '—', date: m.date, meta: m.outcome ?? 'Held' } })
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
      signed: sel.opps.filter((o) => o.status === 'Contract signed')
        .map((o) => ({ company: coName(o.companyId), owner: uName(o.ownerId), date: o.updatedAt, meta: fmtMoney(o.value ?? 0) }))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    }
  }, [sel, companies, allUsers, opportunities])

  const who = memberId ? memberOptions.find((m) => m.id === memberId)?.name
    : teamId ? `${allUsers.find((u) => u.id === teamId)?.name ?? 'Team'}’s team`
      : lcId ? lcs.find((l) => l.id === lcId)?.name
        : user?.role === 'member' ? 'You' : 'All in scope'
  const rangeLabel = from || to ? `${from ? shortDate(from) : '…'} – ${to ? shortDate(to) : '…'}` : 'all time'

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle={who}
        actions={
          <>
            <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            {showLc && (
              <Dropdown
                className="w-40"
                value={lcId}
                onChange={(v) => { setLcId(v); setMemberId('') }}
                options={[{ value: '', label: 'All LCs' }, ...lcs.map((l) => ({ value: l.id, label: l.name }))]}
              />
            )}
            {showTeam && (
              <Dropdown
                className="w-44"
                value={teamId}
                onChange={(v) => { setTeamId(v); setMemberId('') }}
                options={[{ value: '', label: 'All teams' }, ...teamOptions.map((t) => ({ value: t.id, label: `${t.name}’s team` }))]}
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
        <StatCard label="Outreaches" value={fmtNum(sel.k.outreaches)} icon={<Activity size={18} />} hint={`${fmtNum(sel.k.opportunities)} opportunities`} onClick={() => setDrill('outreaches')} cta="See companies" />
        <StatCard label="Meetings" value={fmtNum(sel.k.meetings)} icon={<CalendarCheck size={18} />} accent="var(--accent)" hint={`${fmtNum(sel.k.active)} active`} onClick={() => setDrill('meetings')} cta="See meetings" />
        <StatCard label="Signed" value={fmtNum(sel.k.signed)} icon={<Handshake size={18} />} accent="var(--success)" onClick={() => setDrill('signed')} cta="See contracts" />
        <StatCard label="Conversion" value={fmtPct(sel.k.conversion, 1)} icon={<TrendingUp size={18} />} accent="var(--warning)" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Funnel" subtitle="Opportunities reaching each stage" />
          <FunnelView data={sel.funnel} />
        </Card>
        <Card>
          <SectionTitle title="Credit & revenue" subtitle={`Collected, outstanding & expected · ${who}`} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
              <p className="text-xs text-ink-mute">Received</p>
              <p className="mt-1 font-display text-2xl font-bold text-success">{fmtMoney(sel.rev.received)}</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">collected</p>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs text-ink-mute">Receivable</p>
              <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtMoney(sel.rev.receivable)}</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">signed, awaiting payment</p>
            </div>
            <div className="rounded-2xl border border-info/30 bg-info/5 p-4">
              <p className="text-xs text-ink-mute">Expected pipeline</p>
              <p className="mt-1 font-display text-2xl font-bold text-info">{fmtMoney(sel.pipe.expected)}</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">open deals in range</p>
            </div>
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
              <p className="text-xs text-ink-mute">Weighted forecast</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand">{fmtMoney(Math.round(sel.pipe.weighted))}</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">× stage close-rate</p>
            </div>
          </div>
          {receivablesByMonth(sel.opps).length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Receivables schedule (expected)</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {receivablesByMonth(sel.opps).map((r) => (
                  <li key={r.month || 'none'} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-ink-dim">{r.month ? fmtMonth(r.month) : 'No date set'}</span>
                    <span className="font-medium text-warning">{fmtMoney(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sel.tl.some((p) => p.revenue > 0) && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Received by month</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {sel.tl.filter((p) => p.revenue > 0).map((p) => (
                  <li key={p.month} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-ink-dim">{fmtMonth(p.month)}</span>
                    <span className="font-medium text-ink">{fmtMoney(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle title="Stage conversion" subtitle="Drop-off between stages, and milestone rates" />
        <ConversionBars data={sel.conv} />
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">Milestone conversion</p>
          <ConversionStats data={sel.keyConv} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle title="Activity over time" subtitle="Monthly outreaches, meetings & revenue" />
        <TimelineArea data={sel.tl} />
      </Card>

      {drill && (
        <Modal
          open
          onOpenChange={(o) => !o && setDrill(null)}
          title={drill === 'outreaches' ? 'Companies contacted' : drill === 'meetings' ? 'Meetings held' : 'Contracts signed'}
          description={`${drillData[drill].length} · ${who} · ${rangeLabel}`}
          className="max-w-2xl"
        >
          {drillData[drill].length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-mute">Nothing in this range yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {drill === 'outreaches' && drillData.outreaches.map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <Avatar name={r.company} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.company}</span>
                    <span className="block truncate text-xs text-ink-mute">{r.owner}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-mute">
                    <span className="block text-ink-dim">{r.touches} touch{r.touches === 1 ? '' : 'es'}</span>
                    {shortDate(r.last)}
                  </span>
                </li>
              ))}
              {drill !== 'outreaches' && drillData[drill].map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <Avatar name={r.company} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.company}</span>
                    <span className="block truncate text-xs text-ink-mute">{r.owner}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-mute">
                    <span className={`block font-medium ${drill === 'signed' ? 'text-success' : 'text-ink-dim'}`}>{r.meta}</span>
                    {shortDate(r.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}
