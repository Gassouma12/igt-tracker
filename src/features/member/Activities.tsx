import { useMemo, useState } from 'react'
import { Activity as ActivityIcon, Mail, MessageSquare, Phone, Users } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { OpportunityDialog } from './OpportunityDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/Dropdown'
import { SortHeader, Table, TBody, TD, THead, TR } from '@/components/ui/Table'
import { useSort } from '@/lib/useSort'
import { fmtDate } from '@/lib/format'
import type { ActivityType } from '@/data/types'

const ICON: Record<string, typeof Mail> = {
  LinkedIn: MessageSquare, Email: Mail, 'Cold call': Phone, 'Follow-up': MessageSquare, Meeting: Users,
}
const OUTCOME_TONE = { positive: 'success', neutral: 'neutral', 'no-response': 'danger' } as const

export default function Activities() {
  const { activities, opportunities, companyById } = useScopedData()
  const [type, setType] = useState<ActivityType | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const companyOf = (oppId: string) => {
      const o = opportunities.find((x) => x.id === oppId)
      return o ? companyById(o.companyId)?.name ?? '—' : '—'
    }
    return activities
      .filter((a) => !type || a.type === type)
      .filter((a) => a.date)
      .map((a) => ({ ...a, company: companyOf(a.opportunityId) }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [activities, opportunities, companyById, type])

  const { sorted, sorts, toggle } = useSort(rows, {
    channel: (a) => a.type,
    phase: (a) => a.phase,
    company: (a) => a.company,
    outcome: (a) => a.outcome,
    date: (a) => a.date ?? '',
  })

  return (
    <div>
      <PageHeader
        title="Activities"
        subtitle={`${rows.length} logged touchpoints`}
        actions={
          <Dropdown
            className="w-44"
            value={type}
            onChange={(v) => setType(v as ActivityType | '')}
            options={[{ value: '', label: 'All channels' }, ...['LinkedIn', 'Email', 'Cold call', 'Meeting'].map((c) => ({ value: c, label: c }))]}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={<ActivityIcon size={28} />} title="No activities yet" hint="Log outreach from any opportunity to build your activity history." />
      ) : (
        <Table>
          <THead>
            <TR>
              <SortHeader label="Channel" sortKey="channel" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Phase" sortKey="phase" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Company" sortKey="company" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Outcome" sortKey="outcome" sorts={sorts} onToggle={toggle} />
              <SortHeader label="Date" sortKey="date" sorts={sorts} onToggle={toggle} />
            </TR>
          </THead>
          <TBody>
            {sorted.slice(0, 300).map((a) => {
              const Icon = ICON[a.type] ?? MessageSquare
              return (
                <TR key={a.id} onClick={() => setOpenId(a.opportunityId)}>
                  <TD>
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <Icon size={15} className="text-ink-mute" /> {a.type}{a.count > 1 ? ` ×${a.count}` : ''}
                    </span>
                  </TD>
                  <TD className="capitalize">{a.phase}</TD>
                  <TD className="text-ink">{a.company}</TD>
                  <TD><Badge tone={OUTCOME_TONE[a.outcome]}>{a.outcome}</Badge></TD>
                  <TD>{fmtDate(a.date)}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
