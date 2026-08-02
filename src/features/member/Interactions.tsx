// Unified "Interactions" page — activities (touchpoints) and meetings were two
// near-identical flat lists; this merges them behind one segmented toggle so the
// same data isn't spread across two nav items.
import { useMemo, useState } from 'react'
import { Mail, MessageSquare, Phone, Users } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { OpportunityDialog } from './OpportunityDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/Dropdown'
import { SortHeader, Table, TBody, TD, THead, TR } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { useSort } from '@/lib/useSort'
import { usePaged } from '@/lib/usePaged'
import { fmtDate } from '@/lib/format'
import type { ActivityType } from '@/data/types'

const ICON: Record<string, typeof Mail> = {
  LinkedIn: MessageSquare, Email: Mail, 'Cold call': Phone, 'Follow-up': MessageSquare, Meeting: Users,
}
const OUTCOME_TONE = { positive: 'success', neutral: 'neutral', 'no-response': 'danger' } as const

export default function Interactions() {
  const { activities, meetings, opportunities, companyById, contactById } = useScopedData()
  const [view, setView] = useState<'activities' | 'meetings'>('activities')
  const [type, setType] = useState<ActivityType | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)
  const companyOf = (oppId: string) => {
    const o = opportunities.find((x) => x.id === oppId)
    return o ? companyById(o.companyId)?.name ?? '—' : '—'
  }

  const actRows = useMemo(() => activities
    .filter((a) => (!type || a.type === type) && a.date)
    .map((a) => ({ ...a, company: companyOf(a.opportunityId) }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [activities, opportunities, type]) // eslint-disable-line react-hooks/exhaustive-deps

  const mtgRows = useMemo(() => [...meetings]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map((m) => {
      const o = opportunities.find((x) => x.id === m.opportunityId)
      return { ...m, company: o ? companyById(o.companyId)?.name ?? '—' : '—', contact: o ? contactById(o.contactId)?.name ?? '—' : '—' }
    }),
    [meetings, opportunities]) // eslint-disable-line react-hooks/exhaustive-deps

  const acts = useSort(actRows, { channel: (a) => a.type, phase: (a) => a.phase, company: (a) => a.company, outcome: (a) => a.outcome, date: (a) => a.date ?? '' })
  const mtgs = useSort(mtgRows, { company: (m) => m.company, contact: (m) => m.contact, number: (m) => m.number, date: (m) => m.date ?? '', outcome: (m) => m.outcome ?? '' })
  const actPaged = usePaged(acts.sorted, 25)
  const mtgPaged = usePaged(mtgs.sorted, 25)

  const TABS = [{ id: 'activities', label: `Activities (${actRows.length})` }, { id: 'meetings', label: `Meetings (${mtgRows.length})` }] as const

  return (
    <div>
      <PageHeader
        title="Interactions"
        subtitle="Every touchpoint and meeting logged across your pipeline"
        actions={view === 'activities' && (
          <Dropdown
            className="w-44"
            value={type}
            onChange={(v) => setType(v as ActivityType | '')}
            options={[{ value: '', label: 'All channels' }, ...['LinkedIn', 'Email', 'Cold call', 'Meeting'].map((c) => ({ value: c, label: c }))]}
          />
        )}
      />

      <div className="mb-4 inline-flex gap-1 rounded-xl border border-line bg-bg-elev p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === t.id ? 'bg-brand text-white' : 'text-ink-mute hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'activities' ? (
        actRows.length === 0 ? (
          <EmptyState icon={<MessageSquare size={28} />} title="No activities yet" hint="Log outreach from any opportunity to build your activity history." />
        ) : (
          <>
            <Table>
              <THead><TR>
                <SortHeader label="Channel" sortKey="channel" sorts={acts.sorts} onToggle={acts.toggle} />
                <SortHeader label="Phase" sortKey="phase" sorts={acts.sorts} onToggle={acts.toggle} />
                <SortHeader label="Company" sortKey="company" sorts={acts.sorts} onToggle={acts.toggle} />
                <SortHeader label="Outcome" sortKey="outcome" sorts={acts.sorts} onToggle={acts.toggle} />
                <SortHeader label="Date" sortKey="date" sorts={acts.sorts} onToggle={acts.toggle} />
              </TR></THead>
              <TBody>
                {actPaged.slice.map((a) => {
                  const Icon = ICON[a.type] ?? MessageSquare
                  return (
                    <TR key={a.id} onClick={() => setOpenId(a.opportunityId)}>
                      <TD><span className="flex items-center gap-2 font-medium text-ink"><Icon size={15} className="text-ink-mute" /> {a.type}{a.count > 1 ? ` ×${a.count}` : ''}</span></TD>
                      <TD className="capitalize">{a.phase}</TD>
                      <TD className="text-ink">{a.company}</TD>
                      <TD><Badge tone={OUTCOME_TONE[a.outcome]}>{a.outcome}</Badge></TD>
                      <TD>{fmtDate(a.date)}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            <Pagination page={actPaged.page} pageCount={actPaged.pageCount} from={actPaged.from} to={actPaged.to} total={actPaged.total} onChange={actPaged.setPage} />
          </>
        )
      ) : (
        mtgRows.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title="No meetings yet" hint="Log a meeting from any opportunity to track it here." />
        ) : (
          <>
            <Table>
              <THead><TR>
                <SortHeader label="Company" sortKey="company" sorts={mtgs.sorts} onToggle={mtgs.toggle} />
                <SortHeader label="Contact" sortKey="contact" sorts={mtgs.sorts} onToggle={mtgs.toggle} />
                <SortHeader label="Meeting" sortKey="number" sorts={mtgs.sorts} onToggle={mtgs.toggle} />
                <SortHeader label="Date" sortKey="date" sorts={mtgs.sorts} onToggle={mtgs.toggle} />
                <SortHeader label="Outcome" sortKey="outcome" sorts={mtgs.sorts} onToggle={mtgs.toggle} />
              </TR></THead>
              <TBody>
                {mtgPaged.slice.map((m) => (
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
            <Pagination page={mtgPaged.page} pageCount={mtgPaged.pageCount} from={mtgPaged.from} to={mtgPaged.to} total={mtgPaged.total} onChange={mtgPaged.setPage} />
          </>
        )
      )}

      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
