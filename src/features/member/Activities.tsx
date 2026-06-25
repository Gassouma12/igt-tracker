import { useMemo, useState } from 'react'
import { Activity as ActivityIcon, Mail, MessageSquare, Phone, Users } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { OpportunityDialog } from './OpportunityDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, EmptyState } from '@/components/ui/primitives'
import { Select } from '@/components/ui/Field'
import { fmtDate } from '@/lib/format'
import type { ActivityType } from '@/data/types'
import { cn } from '@/lib/cn'

const ICON: Record<string, typeof Mail> = {
  LinkedIn: MessageSquare, Email: Mail, 'Cold call': Phone, 'Follow-up': MessageSquare, Meeting: Users,
}
const OUTCOME_STYLE: Record<string, string> = {
  positive: 'bg-success/15 text-success', neutral: 'bg-surface-2 text-ink-dim', 'no-response': 'bg-danger/15 text-danger',
}

export default function Activities() {
  const { activities, opportunities, companyById } = useScopedData()
  const [type, setType] = useState<ActivityType | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const oppCompany = (oppId: string) => {
      const o = opportunities.find((x) => x.id === oppId)
      return o ? companyById(o.companyId)?.name ?? '—' : '—'
    }
    const filtered = activities
      .filter((a) => !type || a.type === type)
      .filter((a) => a.date)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, 300)
    const groups = new Map<string, typeof filtered>()
    for (const a of filtered) {
      const key = a.date!.slice(0, 10)
      const arr = groups.get(key) ?? []
      arr.push(a)
      groups.set(key, arr)
    }
    return { groups: [...groups.entries()], company: oppCompany, total: filtered.length }
  }, [activities, opportunities, companyById, type])

  return (
    <div>
      <PageHeader
        title="Activities"
        subtitle={`${grouped.total} logged touchpoints`}
        actions={
          <Select className="max-w-[180px]" value={type} onChange={(e) => setType(e.target.value as ActivityType | '')}>
            <option value="">All channels</option>
            <option>LinkedIn</option><option>Email</option><option>Cold call</option><option>Meeting</option>
          </Select>
        }
      />

      {grouped.total === 0 ? (
        <EmptyState icon={<ActivityIcon size={28} />} title="No activities yet" hint="Log outreach from any opportunity to build your activity history." />
      ) : (
        <div className="space-y-6">
          {grouped.groups.map(([date, items]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">{fmtDate(date)}</p>
              <Card className="divide-y divide-line p-0">
                {items.map((a) => {
                  const Icon = ICON[a.type] ?? MessageSquare
                  return (
                    <button key={a.id} onClick={() => setOpenId(a.opportunityId)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60">
                      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', OUTCOME_STYLE[a.outcome])}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{grouped.company(a.opportunityId)}</span>
                        <span className="block truncate text-xs text-ink-mute">{a.type} · {a.phase}{a.count > 1 ? ` ×${a.count}` : ''}{a.notes ? ` · ${a.notes}` : ''}</span>
                      </span>
                      <span className="text-xs capitalize text-ink-mute">{a.outcome}</span>
                    </button>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
