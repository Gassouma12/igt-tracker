// Two clickable meeting stat cards (had vs scheduled) that open a modal listing
// the underlying meetings/opportunities with dates and info. Used on the LC
// Overview and the admin Global Dashboard — supervisors & admins drill in.

import { useMemo, useState } from 'react'
import { CalendarCheck, CalendarClock } from 'lucide-react'
import { useDB } from '@/data/store'
import { meetingStats } from '@/lib/metrics'
import { fmtDate, fmtNum, relativeDays } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/primitives'
import { CompanyDialog } from '@/features/member/CompanyDialog'
import { OpportunityDialog } from '@/features/member/OpportunityDialog'
import type { Meeting, Opportunity, User } from '@/data/types'

export function MeetingBreakdown({ opps, meetings, users }: { opps: Opportunity[]; meetings: Meeting[]; users: User[] }) {
  const companies = useDB((s) => s.companies)
  const [open, setOpen] = useState<null | 'had' | 'scheduled'>(null)
  const [companyOpen, setCompanyOpen] = useState<string | null>(null)
  const [oppOpen, setOppOpen] = useState<string | null>(null)

  const stats = meetingStats(opps, meetings)
  const companyIdOf = (oppId: string) => opps.find((x) => x.id === oppId)?.companyId ?? null
  const companyOf = (oppId: string) => companies.find((c) => c.id === companyIdOf(oppId))?.name ?? '—'
  const ownerOf = (id: string) => users.find((u) => u.id === id)?.name ?? '—'

  // Open a company's data modal from a meeting row (closes the meeting list first).
  const openCompany = (companyId: string | null) => { if (companyId) { setOpen(null); setCompanyOpen(companyId) } }

  // "had" rows = recorded meetings; "scheduled" rows = opps booked but not held.
  const hadRows = useMemo(
    () => [...meetings].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [meetings],
  )
  const scheduledRows = useMemo(() => {
    const withMeeting = new Set(meetings.map((m) => m.opportunityId))
    return opps.filter((o) => o.status === 'Meeting scheduled' && !withMeeting.has(o.id))
  }, [opps, meetings])

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setOpen('had')} className="text-left transition hover:opacity-90">
          <StatCard label="Meetings had" value={fmtNum(stats.had)} icon={<CalendarCheck size={18} />} accent="var(--success)" hint="recorded · click to view" />
        </button>
        <button onClick={() => setOpen('scheduled')} className="text-left transition hover:opacity-90">
          <StatCard label="Meetings scheduled" value={fmtNum(stats.scheduled)} icon={<CalendarClock size={18} />} accent="var(--info)" hint="booked · click to view" />
        </button>
      </div>

      <Modal
        open={open === 'had'}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Meetings had"
        description={`${hadRows.length} meeting(s) recorded through an interaction`}
        className="max-w-xl"
      >
        {hadRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-mute">No meetings recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {hadRows.map((m) => (
              <li
                key={m.id}
                onClick={() => openCompany(companyIdOf(m.opportunityId))}
                className="cursor-pointer rounded-xl border border-line bg-bg-elev p-3 transition hover:border-brand/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{companyOf(m.opportunityId)}</p>
                  <span className="text-xs text-ink-mute">{fmtDate(m.date)}</span>
                </div>
                <p className="text-xs text-ink-mute">Meeting #{m.number} · {ownerOf(m.ownerId)} · {m.outcome ?? 'Held'}</p>
                {m.notes && <p className="mt-1 text-sm text-ink-dim">{m.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={open === 'scheduled'}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Meetings scheduled"
        description={`${scheduledRows.length} booked, not yet held`}
        className="max-w-xl"
      >
        {scheduledRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-mute">No scheduled meetings.</p>
        ) : (
          <ul className="space-y-2">
            {scheduledRows.map((o) => (
              <li
                key={o.id}
                onClick={() => openCompany(o.companyId)}
                className="cursor-pointer rounded-xl border border-line bg-bg-elev p-3 transition hover:border-brand/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{companyOf(o.id)}</p>
                  <span className="text-xs text-ink-mute">{relativeDays(o.lastActivityAt)}</span>
                </div>
                <p className="text-xs text-ink-mute">
                  {ownerOf(o.ownerId)}{o.nextAction ? ` · ${o.nextAction} (${fmtDate(o.nextActionDate)})` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <CompanyDialog companyId={companyOpen} onClose={() => setCompanyOpen(null)} onOpenOpp={(id) => { setCompanyOpen(null); setOppOpen(id) }} />
      <OpportunityDialog oppId={oppOpen} onClose={() => setOppOpen(null)} />
    </>
  )
}
