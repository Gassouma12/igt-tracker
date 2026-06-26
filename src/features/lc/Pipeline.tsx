import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useLC } from './useLC'
import { OpportunityDialog } from '@/features/member/OpportunityDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/primitives'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SortHeader, Table, TBody, TD, THead, TR } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { fmtDate, relativeDays } from '@/lib/format'
import { useSort } from '@/lib/useSort'
import { OPPORTUNITY_STATUSES, type OpportunityStatus } from '@/data/types'

export default function Pipeline() {
  const { opportunities, members, companyById, contactById, userById } = useLC()
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState<OpportunityStatus | ''>('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return opportunities
      .filter((o) => (!owner || o.ownerId === owner) && (!status || o.status === status))
      .filter((o) => !term || companyById(o.companyId)?.name.toLowerCase().includes(term))
  }, [opportunities, owner, status, q, companyById])

  const { sorted, sorts, toggle } = useSort(rows, {
    company: (o) => companyById(o.companyId)?.name ?? '',
    owner: (o) => userById(o.ownerId)?.name ?? '',
    contact: (o) => contactById(o.contactId)?.name ?? '',
    stage: (o) => OPPORTUNITY_STATUSES.indexOf(o.status),
    activity: (o) => o.lastActivityAt ?? '',
    next: (o) => o.nextActionDate ?? '',
  })

  return (
    <div>
      <PageHeader title="LC Pipeline" subtitle={`${rows.length} of ${opportunities.length} opportunities`} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Filter by company…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Dropdown
          className="w-44"
          value={owner}
          onChange={setOwner}
          options={[{ value: '', label: 'All members' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
        <Dropdown
          className="w-44"
          value={status}
          onChange={(v) => setStatus(v as OpportunityStatus | '')}
          options={[{ value: '', label: 'All stages' }, ...OPPORTUNITY_STATUSES.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      <Table>
        <THead>
          <TR>
            <SortHeader label="Company" sortKey="company" sorts={sorts} onToggle={toggle} />
            <SortHeader label="Owner" sortKey="owner" sorts={sorts} onToggle={toggle} />
            <SortHeader label="Contact" sortKey="contact" sorts={sorts} onToggle={toggle} />
            <SortHeader label="Stage" sortKey="stage" sorts={sorts} onToggle={toggle} />
            <SortHeader label="Last activity" sortKey="activity" sorts={sorts} onToggle={toggle} />
            <SortHeader label="Next action" sortKey="next" sorts={sorts} onToggle={toggle} />
          </TR>
        </THead>
        <TBody>
          {sorted.slice(0, 300).map((o) => (
            <TR key={o.id} onClick={() => setOpenId(o.id)}>
              <TD className="font-medium text-ink">{companyById(o.companyId)?.name ?? '—'}</TD>
              <TD>
                <span className="flex items-center gap-2">
                  <Avatar name={userById(o.ownerId)?.name ?? '?'} size={22} />
                  <span className="text-ink-dim">{userById(o.ownerId)?.name ?? '—'}</span>
                </span>
              </TD>
              <TD>{contactById(o.contactId)?.name ?? '—'}</TD>
              <TD><StatusBadge status={o.status} /></TD>
              <TD>{relativeDays(o.lastActivityAt)}</TD>
              <TD>{o.nextAction ? `${o.nextAction} · ${fmtDate(o.nextActionDate)}` : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
