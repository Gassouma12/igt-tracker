// Company-level Notes (editable insights) and History (every logged interaction
// across the company's opportunities). Shared by CompanyDialog and the lead
// detail panel so both the Companies tab and the pipeline expose them.

import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Mail, MessageSquare, Phone, Users } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { setCompanyNotes } from '@/data/actions'
import { canEditOwned, visibleOwnerIds } from '@/lib/rbac'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Textarea } from '@/components/ui/Field'
import { fmtDate, relativeDays } from '@/lib/format'
import { cn } from '@/lib/cn'

const NOTES_PLACEHOLDER = 'Insights about the interactions, what products are they interested in, etc...'

const TYPE_ICON: Record<string, typeof Mail> = {
  LinkedIn: MessageSquare, Email: Mail, 'Cold call': Phone, 'Follow-up': MessageSquare, Meeting: CalendarPlus,
}

export function CompanyNotesModal({ companyId, open, onClose }: { companyId: string | null; open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const company = useDB((s) => s.companies.find((c) => c.id === companyId))
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText(company?.notes ?? '') }, [open, company])

  // Anyone who can edit at least one of this company's opps may edit notes; else read-only.
  const allOpps = useDB((s) => s.opportunities)
  const canEdit = !!user && allOpps.some((o) => o.companyId === companyId && canEditOwned(user, o.ownerId))

  function save() {
    if (user && company) setCompanyNotes(user, company, text)
    onClose()
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`Notes · ${company?.name ?? ''}`} description="Shared context about this company.">
      {canEdit ? (
        <>
          <Textarea className="min-h-[180px]" placeholder={NOTES_PLACEHOLDER} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save notes</Button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-ink-dim">{company?.notes || 'No notes yet.'}</p>
      )}
    </Modal>
  )
}

export function CompanyHistoryModal({ companyId, open, onClose }: { companyId: string | null; open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const company = useDB((s) => s.companies.find((c) => c.id === companyId))
  const allOpps = useDB((s) => s.opportunities)
  const allActs = useDB((s) => s.activities)
  const allMtgs = useDB((s) => s.meetings)
  const users = useDB((s) => s.users)

  const items = useMemo(() => {
    if (!company || !user) return []
    const owners = visibleOwnerIds(user, users)
    const opps = allOpps.filter((o) => o.companyId === company.id && (!owners || owners.has(o.ownerId)))
    const ids = new Set(opps.map((o) => o.id))
    const ownerName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'
    const acts = allActs.filter((a) => ids.has(a.opportunityId)).map((a) => ({
      key: a.id, type: a.type, label: `${a.type} · ${a.phase}`, outcome: a.outcome,
      date: a.date, notes: a.notes, owner: ownerName(a.ownerId),
    }))
    const mtgs = allMtgs.filter((m) => ids.has(m.opportunityId)).map((m) => ({
      key: m.id, type: 'Meeting', label: `Meeting #${m.number}`, outcome: 'neutral' as const,
      date: m.date, notes: m.notes ?? null, owner: ownerName(m.ownerId),
    }))
    return [...acts, ...mtgs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [company, user, allOpps, allActs, allMtgs, users])

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`History · ${company?.name ?? ''}`} description={`${items.length} interaction(s) across all opportunities`} className="max-w-xl">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-mute">No interactions logged yet.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((it) => {
            const Icon = TYPE_ICON[it.type] ?? MessageSquare
            return (
              <li key={it.key} className="flex gap-3 rounded-2xl border border-line bg-bg-elev p-3">
                <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full',
                  it.outcome === 'positive' ? 'bg-success/15 text-success' : it.outcome === 'no-response' ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-ink-dim')}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{it.label}</p>
                    <span className="shrink-0 text-xs text-ink-mute">{fmtDate(it.date)} · {relativeDays(it.date)}</span>
                  </div>
                  <p className="text-xs text-ink-mute">{it.owner}</p>
                  {it.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{it.notes}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}

/** Notes + History trigger buttons + their modals, for a given company. */
export function CompanyPanelButtons({ companyId }: { companyId: string | null }) {
  const [notes, setNotes] = useState(false)
  const [history, setHistory] = useState(false)
  if (!companyId) return null
  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setNotes(true)}>Notes</Button>
        <Button size="sm" variant="secondary" onClick={() => setHistory(true)}>History</Button>
      </div>
      <CompanyNotesModal companyId={companyId} open={notes} onClose={() => setNotes(false)} />
      <CompanyHistoryModal companyId={companyId} open={history} onClose={() => setHistory(false)} />
    </>
  )
}
