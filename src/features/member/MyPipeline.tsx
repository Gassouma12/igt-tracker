import { useEffect, useMemo, useState } from 'react'
import { BarChart3, LayoutGrid, Plus, Table as TableIcon } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { useFocus } from '@/state/focus'
import { OpportunityDialog } from './OpportunityDialog'
import { AddOpportunityDialog } from './AddOpportunityDialog'
import { useCurrentUser } from '@/state/session'
import { advanceStage } from '@/data/actions'
import { canEditOwned } from '@/lib/rbac'
import { FUNNEL } from '@/lib/metrics'
import { OPPORTUNITY_STATUSES, type Opportunity, type OpportunityStatus } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/primitives'
import { StatusBadge, STATUS_STYLE } from '@/components/ui/StatusBadge'
import { SortHeader, Table, TBody, TD, THead, TR } from '@/components/ui/Table'
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
  const [stages, setStages] = useState<OpportunityStatus[]>([]) // empty = all stages
  const editable = (o: Opportunity) => !!user && canEditOwned(user, o.ownerId)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<OpportunityStatus | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // When a notification focuses a lead, jump to the table, clear filters, then
  // scroll to + pulse the row briefly.
  const highlightId = useFocus((s) => s.highlightId)
  const setHighlight = useFocus((s) => s.setHighlight)
  useEffect(() => {
    if (!highlightId) return
    setView('table'); setStages([]); setFrom(''); setTo('')
    const t1 = setTimeout(() => document.getElementById(`row-${highlightId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
    const t2 = setTimeout(() => setHighlight(null), 3400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [highlightId, setHighlight])

  // "My" pipeline = only the signed-in user's OWN opportunities. (For lcvp/lcp,
  // useScopedData returns the whole LC; the LC-wide board lives on /lc/pipeline.)
  const owned = useMemo(() => {
    const opps = opportunities.filter((o) => o.ownerId === user?.id)
    const ids = new Set(opps.map((o) => o.id))
    return {
      opps,
      acts: activities.filter((a) => ids.has(a.opportunityId)),
      mtgs: meetings.filter((m) => ids.has(m.opportunityId)),
      cons: contracts.filter((c) => ids.has(c.opportunityId)),
    }
  }, [opportunities, activities, meetings, contracts, user])

  const months = useMemo(() => availableMonths(owned.acts.map((a) => a.date)), [owned])

  const ranged = useMemo(() => {
    if (!from && !to) return owned
    const opps = owned.opps.filter((o) => inMonthRange(o.lastActivityAt, from, to) || inMonthRange(o.createdAt, from, to))
    const ids = new Set(opps.map((o) => o.id))
    return {
      opps,
      acts: owned.acts.filter((a) => ids.has(a.opportunityId) && inMonthRange(a.date, from, to)),
      mtgs: owned.mtgs.filter((m) => ids.has(m.opportunityId) && inMonthRange(m.date, from, to)),
      cons: owned.cons.filter((c) => ids.has(c.opportunityId)),
    }
  }, [owned, from, to])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return ranged.opps.filter((o) => {
      if (stages.length && !stages.includes(o.status)) return false
      if (term && !companyById(o.companyId)?.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [ranged, stages, search, companyById])

  const byStatus = (s: OpportunityStatus) => filtered.filter((o) => o.status === s)

  const { sorted, sorts, toggle } = useSort(filtered, {
    company: (o) => companyById(o.companyId)?.name ?? '',
    contact: (o) => contactById(o.contactId)?.name ?? '',
    stage: (o) => OPPORTUNITY_STATUSES.indexOf(o.status),
    activity: (o) => o.lastActivityAt ?? '',
    next: (o) => o.nextActionDate ?? '',
  })

  // keep a focused (highlighted) lead at the top so it's always rendered/visible
  const display = useMemo(() => {
    const hit = highlightId && sorted.find((o) => o.id === highlightId)
    return hit ? [hit, ...sorted.filter((o) => o.id !== highlightId)] : sorted
  }, [sorted, highlightId])

  function onDrop(status: OpportunityStatus) {
    setOverCol(null)
    if (!dragId || !user) return
    const opp = opportunities.find((o) => o.id === dragId)
    if (opp && editable(opp) && opp.status !== status) advanceStage(user, opp, status)
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
                        draggable={editable(o)}
                        onDragStart={(e) => { if (!editable(o)) return; setDragId(o.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDragEnd={() => { setDragId(null); setOverCol(null) }}
                        onClick={() => setOpenId(o.id)}
                        className={cn(
                          'rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand/40 hover:shadow-card',
                          editable(o) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
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
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-ink-mute">Stages:</span>
            {OPPORTUNITY_STATUSES.map((s) => {
              const on = stages.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => setStages((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                  className={cn('chip border transition', on ? 'border-transparent' : 'border-line bg-transparent text-ink-mute hover:text-ink')}
                  style={on ? { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].text } : undefined}
                >
                  {s}
                </button>
              )
            })}
            {stages.length > 0 && (
              <button onClick={() => setStages([])} className="ml-1 text-xs text-ink-mute underline transition hover:text-ink">clear</button>
            )}
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
              {display.slice(0, 200).map((o: Opportunity) => {
                const c = companyById(o.companyId)
                const ct = contactById(o.contactId)
                return (
                  <TR key={o.id} id={`row-${o.id}`} className={cn(highlightId === o.id && 'row-pulse')} onClick={() => setOpenId(o.id)}>
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
