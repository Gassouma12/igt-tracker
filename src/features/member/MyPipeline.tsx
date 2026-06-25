import { useMemo, useState } from 'react'
import { LayoutGrid, Plus, Table as TableIcon } from 'lucide-react'
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
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Select } from '@/components/ui/Field'
import { fmtDate, relativeDays } from '@/lib/format'
import { useFilters } from '@/state/filters'

const COLUMNS: OpportunityStatus[] = [...FUNNEL, 'Lost']

export default function MyPipeline() {
  const user = useCurrentUser()
  const { opportunities, companyById, contactById } = useScopedData()
  const search = useFilters((s) => s.search)
  const [view, setView] = useState<'board' | 'table'>('board')
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return opportunities.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false
      if (term && !(companyById(o.companyId)?.name.toLowerCase().includes(term))) return false
      return true
    })
  }, [opportunities, statusFilter, search, companyById])

  const byStatus = (s: OpportunityStatus) => filtered.filter((o) => o.status === s)

  function onDrop(status: OpportunityStatus) {
    if (!dragId || !user) return
    const opp = opportunities.find((o) => o.id === dragId)
    if (opp && opp.status !== status) advanceStage(user, opp, status)
    setDragId(null)
  }

  return (
    <div>
      <PageHeader
        title="My Pipeline"
        subtitle={`${filtered.length} opportunities${search ? ` · filtered by “${search}”` : ''}`}
        actions={
          <>
            <div className="flex overflow-hidden rounded-xl border border-line">
              <button onClick={() => setView('board')} className={`grid h-10 w-10 place-items-center ${view === 'board' ? 'bg-surface-2 text-ink' : 'text-ink-mute'}`}><LayoutGrid size={16} /></button>
              <button onClick={() => setView('table')} className={`grid h-10 w-10 place-items-center ${view === 'table' ? 'bg-surface-2 text-ink' : 'text-ink-mute'}`}><TableIcon size={16} /></button>
            </div>
            <Button onClick={() => setAdding(true)}><Plus size={16} /> New opportunity</Button>
          </>
        }
      />

      {view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((status) => {
            const items = byStatus(status)
            return (
              <div
                key={status}
                className="flex w-72 shrink-0 flex-col rounded-2xl border border-line bg-bg-elev/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(status)}
              >
                <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[status].dot }} />
                    {status}
                  </span>
                  <span className="text-xs text-ink-mute">{items.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {items.slice(0, 50).map((o) => {
                    const c = companyById(o.companyId)
                    const ct = contactById(o.contactId)
                    return (
                      <button
                        key={o.id}
                        draggable
                        onDragStart={() => setDragId(o.id)}
                        onClick={() => setOpenId(o.id)}
                        className="cursor-grab rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand/40 active:cursor-grabbing"
                      >
                        <p className="truncate text-sm font-medium text-ink">{c?.name ?? '—'}</p>
                        {ct && <p className="truncate text-xs text-ink-mute">{ct.name}</p>}
                        <p className="mt-1.5 text-[11px] text-ink-mute">{relativeDays(o.lastActivityAt)}</p>
                      </button>
                    )
                  })}
                  {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-ink-mute">Drop here</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Select className="max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OpportunityStatus | '')}>
              <option value="">All stages</option>
              {OPPORTUNITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <Table>
            <THead>
              <TR><TH>Company</TH><TH>Contact</TH><TH>Stage</TH><TH>Last activity</TH><TH>Next action</TH></TR>
            </THead>
            <TBody>
              {filtered.slice(0, 200).map((o: Opportunity) => {
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
