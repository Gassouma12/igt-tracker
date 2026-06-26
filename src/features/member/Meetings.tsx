import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { OpportunityDialog } from './OpportunityDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { SortHeader, Table, TBody, TD, THead, TR } from '@/components/ui/Table'
import { fmtDate } from '@/lib/format'
import { useSort } from '@/lib/useSort'

export default function Meetings() {
  const { meetings, opportunities, companyById, contactById } = useScopedData()
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const oppOf = (id: string) => opportunities.find((o) => o.id === id)
    return [...meetings]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .map((m) => {
        const o = oppOf(m.opportunityId)
        return {
          ...m,
          company: o ? companyById(o.companyId)?.name ?? '—' : '—',
          contact: o ? contactById(o.contactId)?.name ?? '—' : '—',
        }
      })
  }, [meetings, opportunities, companyById, contactById])

  const upcoming = rows.filter((r) => r.date && r.date >= new Date().toISOString().slice(0, 10)).length

  const { sorted, sorts, toggle } = useSort(rows, {
    company: (m) => m.company,
    contact: (m) => m.contact,
    number: (m) => m.number,
    date: (m) => m.date ?? '',
    outcome: (m) => m.outcome ?? '',
  })

  return (
    <div>
      <PageHeader title="Meetings" subtitle={`${rows.length} meetings · ${upcoming} upcoming`} />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarDays size={28} />} title="No meetings yet" hint="Log a meeting from any opportunity to track it here." />
      ) : (
        <Table>
          <THead>
            <TR>
              <SortHeader label="Company" sortKey="company" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Contact" sortKey="contact" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Meeting" sortKey="number" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Date" sortKey="date" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Outcome" sortKey="outcome" sorts={sorts} onToggle={toggle} />
            </TR>
          </THead>
          <TBody>
            {sorted.slice(0, 200).map((m) => (
              <TR key={m.id} onClick={() => setOpenId(m.opportunityId)}>
                <TD className="font-medium text-ink">{m.company}</TD>
                <TD>{m.contact}</TD>
                <TD>#{m.number}</TD>
                <TD>{fmtDate(m.date)}</TD>
                <TD><Badge tone={m.number === 1 ? 'info' : 'brand'}>{m.outcome ?? 'Held'}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
