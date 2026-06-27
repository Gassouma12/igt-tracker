import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Moon, TimerReset, TrendingDown } from 'lucide-react'
import { useLC } from './useLC'
import { conversions, kpis, reminders, statusDistribution, timeline, FUNNEL } from '@/lib/metrics'
import { fmtMonth, fmtNum, fmtPct } from '@/lib/format'
import { availableMonths, inMonthRange } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, SectionTitle, StatCard } from '@/components/ui/primitives'
import { StatusBadge, STATUS_STYLE } from '@/components/ui/StatusBadge'
import { MonthRange } from '@/components/ui/MonthRange'
import { ConversionBars, Histogram, PieBreakdown } from '@/components/charts/Charts'

function toCSV(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Reports() {
  const { lc, opportunities, activities, meetings, contracts, companyById, contactById, userById } = useLC()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const months = useMemo(() => availableMonths(activities.map((a) => a.date)), [activities])

  const ranged = useMemo(() => {
    if (!from && !to) return { opps: opportunities, acts: activities, mtgs: meetings, cons: contracts }
    const opps = opportunities.filter((o) => inMonthRange(o.lastActivityAt, from, to) || inMonthRange(o.createdAt, from, to))
    const ids = new Set(opps.map((o) => o.id))
    return {
      opps,
      acts: activities.filter((a) => ids.has(a.opportunityId) && inMonthRange(a.date, from, to)),
      mtgs: meetings.filter((m) => ids.has(m.opportunityId) && inMonthRange(m.date, from, to)),
      cons: contracts.filter((c) => ids.has(c.opportunityId)),
    }
  }, [opportunities, activities, meetings, contracts, from, to])

  const d = useMemo(() => {
    const k = kpis(ranged.opps, ranged.acts, ranged.mtgs, ranged.cons)
    const dist = statusDistribution(ranged.opps)
    const conv = conversions(ranged.opps)
    const tl = timeline(ranged.acts, ranged.mtgs, ranged.cons)
    const rem = reminders(ranged.opps, ranged.mtgs)
    // Biggest drop-off = lowest conversion among consecutive funnel steps.
    const worst = [...conv].filter((c) => c.rate < 1).sort((a, b) => a.rate - b.rate)[0]
    // Stage holding the most stuck (non-signed) leads.
    const stuck = [...FUNNEL].filter((s) => s !== 'Contract signed')
      .map((s) => ({ s, n: dist[s] }))
      .sort((a, b) => b.n - a.n)[0]
    return {
      k, dist, conv, tl, worst, stuck,
      inactive: rem.filter((r) => r.kind === 'inactive').length,
      overdue: rem.filter((r) => r.kind === 'overdue').length,
    }
  }, [ranged])

  const pieData = [...FUNNEL, 'Lost'].map((s) => ({
    name: s, value: d.dist[s as keyof typeof d.dist], color: STATUS_STYLE[s as keyof typeof STATUS_STYLE].dot,
  }))
  const histData = d.tl.map((p) => ({ label: fmtMonth(p.month), value: p.outreaches }))

  function exportCSV() {
    const header = ['Company', 'Owner', 'Contact', 'Stage', 'Created', 'Last activity', 'Next action', 'Next action date']
    const body = ranged.opps.map((o) => [
      companyById(o.companyId)?.name ?? '', userById(o.ownerId)?.name ?? '',
      contactById(o.contactId)?.name ?? '', o.status, o.createdAt ?? '',
      o.lastActivityAt ?? '', o.nextAction ?? '', o.nextActionDate ?? '',
    ])
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lc?.name ?? 'LC'}-pipeline-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`${lc?.name ?? 'LC'} · pipeline health${from || to ? ' · date-filtered' : ''}`}
        actions={
          <>
            <MonthRange months={months} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <Button variant="secondary" onClick={exportCSV}><Download size={16} /> Export CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Opportunities" value={fmtNum(d.k.opportunities)} />
        <StatCard label="Outreaches" value={fmtNum(d.k.outreaches)} accent="var(--accent)" hint={`${fmtNum(d.k.followups)} follow-ups`} />
        <StatCard label="Meetings" value={fmtNum(d.k.meetings)} accent="var(--info)" hint={`${fmtNum(d.k.meetingsScheduled)} scheduled`} />
        <StatCard label="Signed" value={fmtNum(d.k.signed)} accent="var(--success)" hint={`${fmtPct(d.k.conversion, 1)} conversion`} />
      </div>

      {/* bottlenecks — what's not working */}
      <Card className="mt-4 border-warning/30">
        <SectionTitle title="Bottlenecks" subtitle="Where the pipeline is leaking" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Bottleneck icon={<TrendingDown size={16} />} tone="danger"
            label="Biggest drop-off"
            value={d.worst ? `${fmtPct(d.worst.rate, 0)}` : '—'}
            hint={d.worst ? `${d.worst.from} → ${d.worst.to}` : 'No drop-off'} />
          <Bottleneck icon={<AlertTriangle size={16} />} tone="warning"
            label="Most stuck at"
            value={d.stuck ? fmtNum(d.stuck.n) : '0'}
            hint={d.stuck ? d.stuck.s : '—'} />
          <Bottleneck icon={<Moon size={16} />} tone="warning"
            label="Inactive leads" value={fmtNum(d.inactive)} hint="no activity 21d+" />
          <Bottleneck icon={<TimerReset size={16} />} tone="danger"
            label="Overdue follow-ups" value={fmtNum(d.overdue)} hint="past their due date" />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Pipeline by stage" subtitle="Share of opportunities" />
          <PieBreakdown data={pieData} />
        </Card>
        <Card>
          <SectionTitle title="Stage conversion" subtitle="Drop-off between consecutive stages" />
          <ConversionBars data={d.conv} />
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle title="Outreaches per month" subtitle="Companies reached over time" />
        <Histogram data={histData} color="var(--accent)" />
      </Card>

      <Card className="mt-4">
        <SectionTitle title="Pipeline by stage" subtitle="Detailed counts" />
        <ul className="space-y-2.5 pt-1">
          {[...FUNNEL, 'Lost'].map((s) => {
            const n = d.dist[s as keyof typeof d.dist]
            const pct = d.k.opportunities ? n / d.k.opportunities : 0
            return (
              <li key={s} className="flex items-center gap-3">
                <span className="w-40 shrink-0"><StatusBadge status={s as never} /></span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: STATUS_STYLE[s as keyof typeof STATUS_STYLE].dot }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-ink-mute">{fmtNum(n)} · {fmtPct(pct, 0)}</span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

const TONE: Record<string, string> = {
  danger: 'border-danger/30 bg-danger/5 text-danger',
  warning: 'border-warning/30 bg-warning/5 text-warning',
}
function Bottleneck({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone: 'danger' | 'warning' }) {
  return (
    <div className={`rounded-2xl border p-3 ${TONE[tone]}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium">{icon} {label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-mute">{hint}</p>
    </div>
  )
}
