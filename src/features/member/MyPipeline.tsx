import { useMemo, useState } from 'react'
import { BarChart3, LayoutGrid, Plus, Table as TableIcon } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { OpportunityDialog } from './OpportunityDialog'
import { AddOpportunityDialog } from './AddOpportunityDialog'
import { useCurrentUser } from '@/state/session'
import { advanceStage } from '@/data/actions'
import { FUNNEL } from '@/lib/metrics'
import { OPPORTUNITY_STATUSES, type Opportunity, type OpportunityStatus } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/primitives'
import { StatusBadge, STATUS_STYLE } from '@/components/ui/StatusBadge'
import { SortHeader, Table, TBody, TD, THead, TR } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { MonthRange } from '@/components/ui/MonthRange'
import { PipelineSummary } from '@/features/shared/PipelineSummary'
import { fmtDate, relativeDays } from '@/lib/format'
import { availableMonths, inMonthRange } from '@/lib/dates'
import { useFilters } from '@/state/filters'
import { useSort } from '@/lib/useSort'
import { cn } from '@/lib/cn'

const COLUMNS: OpportunityStatus[] = [...FUNNEL, 'Lost']
type View = 'board' | 'table' | 'summary'

export default function MyPipeline() {
  const user = useCurrentUser()
  const { opportunities, activities, meetings, contracts, companyById, contactById } = useScopedData()
  const search = useFilters((s) => s.search)
  const [view, setView] = useState<View>('board')
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<OpportunityStatus | null>(null)
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return ranged.opps.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false
      if (term && !companyById(o.companyId)?.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [ranged, statusFilter, search, companyById])

  const byStatus = (s: OpportunityStatus) => filtered.filter((o) => o.status === s)

  const { sorted, sorts, toggle } = useSort(filtered, {
    company: (o) => companyById(o.companyId)?.name ?? '',
    contact: (o) => contactById(o.contactId)?.name ?? '',
    stage: (o) => OPPORTUNITY_STATUSES.indexOf(o.status),
    activity: (o) => o.lastActivityAt ?? '',
    next: (o) => o.nextActionDate ?? '',
  })

  function onDrop(status: OpportunityStatus) {
    setOverCol(null)
    if (!dragId || !user) return
    const opp = opportunities.find((o) => o.id === dragId)
    if (opp && opp.status !== status) advanceStage(user, opp, status)
    setDragId(null)
  }
  const dragStatus = dragId ? opportunities.find((o) => o.id === dragId)?.status : null

  const VIEWS: { id: View; icon: typeof LayoutGrid }[] = [
    { id: 'board', icon: LayoutGrid }, { id: 'table', icon: TableIcon }, { id: 'summary', icon: BarChart3 },
  ]

  return (
    <div>
      <PageHeader
        title="My Pipeline"
        subtitle={`${filtered.length} opportunities${search ? ` · “${search}”` : ''}${from || to ? ' · date-filtered' : ''}`}
        actions={
          <>
            <MonthRange months={months} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <div className="flex overflow-hidden rounded-xl border border-line">
              {VIEWS.map((v) => (
                <button key={v.id} onClick={() => setView(v.id)} className={cn('grid h-10 w-10 place-items-center transition', view === v.id ? 'bg-surface-2 text-ink' : 'text-ink-mute hover:text-ink')}>
                  <v.icon size={16} />
                </button>
              ))}
            </div>
            <Button onClick={() => setAdding(true)}><Plus size={16} /> New opportunity</Button>
          </>
        }
      />

      {view === 'summary' ? (
        <PipelineSummary opps={ranged.opps} activities={ranged.acts} meetings={ranged.mtgs} contracts={ranged.cons} />
      ) : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((status) => {
            const items = byStatus(status)
            const isTarget = !!dragId && overCol === status && dragStatus !== status
            const droppable = !!dragId && dragStatus !== status
            return (
              <div
                key={status}
                className={cn(
                  'flex w-72 shrink-0 flex-col rounded-2xl border bg-bg-elev/50 transition-colors duration-150',
                  isTarget ? 'border-brand bg-brand/10 ring-2 ring-brand/40' : 'border-line',
                  droppable && !isTarget && 'border-dashed border-brand/40',
                )}
                onDragOver={(e) => { e.preventDefault(); if (overCol !== status) setOverCol(status) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === status ? null : c)) }}
                onDrop={() => onDrop(status)}
              >
                <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[status].dot }} />
                    {status}
                  </span>
                  <span className={cn('rounded-full px-2 text-xs', isTarget ? 'bg-brand/20 text-brand' : 'text-ink-mute')}>{items.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {items.slice(0, 50).map((o) => {
                    const c = companyById(o.companyId)
                    const ct = contactById(o.contactId)
                    return (
                      <button
                        key={o.id}
                        draggable
                        onDragStart={(e) => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDragEnd={() => { setDragId(null); setOverCol(null) }}
                        onClick={() => setOpenId(o.id)}
                        className={cn(
                          'cursor-grab rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand/40 hover:shadow-card active:cursor-grabbing',
                          dragId === o.id && 'rotate-1 opacity-40 ring-2 ring-brand/50',
                        )}
                      >
                        <p className="truncate text-sm font-medium text-ink">{c?.name ?? '—'}</p>
                        {ct && <p className="truncate text-xs text-ink-mute">{ct.name}</p>}
                        <p className="mt-1.5 text-[11px] text-ink-mute">{relativeDays(o.lastActivityAt)}</p>
                      </button>
                    )
                  })}
                  {items.length === 0 && (
                    <p className={cn('rounded-xl border border-dashed px-1 py-6 text-center text-xs transition-colors',
                      isTarget ? 'border-brand/50 text-brand' : 'border-transparent text-ink-mute')}>
                      {droppable ? 'Drop here' : 'Empty'}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Dropdown
              className="w-48"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as OpportunityStatus | '')}
              options={[{ value: '', label: 'All stages' }, ...OPPORTUNITY_STATUSES.map((s) => ({ value: s, label: s }))]}
            />
          </div>
          <Table>
            <THead>
              <TR>
                <SortHeader label="Company" sortKey="company" sorts={sorts} onToggle={toggle} />
                <SortHeader label="Contact" sortKey="contact" sorts={sorts} onToggle={toggle} />
                <SortHeader label="Stage" sortKey="stage" sorts={sorts} onToggle={toggle} />
                <SortHeader label="Last activity" sortKey="activity" sorts={sorts} onToggle={toggle} />
                <SortHeader label="Next action" sortKey="next" sorts={sorts} onToggle={toggle} />
              </TR>
            </THead>
            <TBody>
              {sorted.slice(0, 200).map((o: Opportunity) => {
                const c = companyById(o.companyId)
                const ct = contactById(o.contactId)
                return (
                  <TR key={o.id} onClick={() => setOpenId(o.id)}>
                    <TD className="font-medium text-ink">{c?.name ?? '—'}</TD>
                    <TD>{ct?.name ?? '—'}</TD>
                    <TD><StatusBadge status={o.status} /></TD>
                    <TD>{relativeDays(o.lastActivityAt)}</TD>
                    <TD>{o.nextAction ? `${o.nextAction} · ${fmtDate(o.nextActionDate)}` : '—'}</TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </>
      )}

      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
      <AddOpportunityDialog open={adding} onClose={() => setAdding(false)} onCreated={(id) => setOpenId(id)} />
    </div>
  )
}
