import { useMemo, useState } from 'react'
import { CalendarPlus, Eye, Mail, MessageSquare, Phone, Users, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDB, todayISO } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import {
  addMeeting, advanceStage, logActivity, scheduleFollowUp, setDealValue, setRevenueReceived,
} from '@/data/actions'
import { canEditOwned } from '@/lib/rbac'
import { OPPORTUNITY_STATUSES, type ActivityOutcome, type ActivityType } from '@/data/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/primitives'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Dropdown } from '@/components/ui/Dropdown'
import { LinkedInLink } from '@/components/ui/LinkedInLink'
import { fmtDate, fmtMoney, relativeDays } from '@/lib/format'
import { cn } from '@/lib/cn'

const TYPE_ICON: Record<string, typeof Mail> = {
  LinkedIn: MessageSquare, Email: Mail, 'Cold call': Phone, 'Follow-up': MessageSquare, Meeting: Users,
}
// What did you do? One clear control instead of two overlapping meeting paths.
const CHANNELS: { type: ActivityType; label: string; icon: typeof Mail }[] = [
  { type: 'LinkedIn', label: 'LinkedIn', icon: MessageSquare },
  { type: 'Email', label: 'Email', icon: Mail },
  { type: 'Cold call', label: 'Call', icon: Phone },
  { type: 'Meeting', label: 'Meeting', icon: CalendarPlus },
]

export function OpportunityDialog({ oppId, onClose }: { oppId: string | null; onClose: () => void }) {
  const user = useCurrentUser()
  // Select whole arrays (stable refs) and derive with useMemo — filtering inside
  // a zustand selector returns a new array each render -> infinite loop.
  const opp = useDB((s) => s.opportunities.find((o) => o.id === oppId))
  const allActivities = useDB((s) => s.activities)
  const allMeetings = useDB((s) => s.meetings)
  const company = useDB((s) => s.companies.find((c) => c.id === opp?.companyId))
  const contact = useDB((s) => s.contacts.find((c) => c.id === opp?.contactId))
  const contract = useDB((s) => s.contracts.find((c) => c.opportunityId === oppId))
  const activities = useMemo(() => allActivities.filter((a) => a.opportunityId === oppId), [allActivities, oppId])
  const meetings = useMemo(() => allMeetings.filter((m) => m.opportunityId === oppId), [allMeetings, oppId])

  const [type, setType] = useState<ActivityType>('Email')
  const [phase, setPhase] = useState<'first' | 'follow-up'>('first')
  const [outcome, setOutcome] = useState<ActivityOutcome>('neutral')
  const [notes, setNotes] = useState('')
  const [intDate, setIntDate] = useState('')
  const [faDate, setFaDate] = useState('')
  const [faText, setFaText] = useState('')

  if (!opp || !user) return null
  const canEdit = canEditOwned(user, opp.ownerId)
  const isMeeting = type === 'Meeting'
  const timeline = [...activities].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  async function logInteraction() {
    if (!user) return
    const date = intDate || todayISO()
    if (type === 'Meeting') await addMeeting(user, opp!, { date })
    else await logActivity(user, opp!, { type, phase, outcome, notes, date })
    setNotes(''); setIntDate('')
  }

  return (
    <Dialog.Root open={!!oppId} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-line bg-bg shadow-pop data-[state=open]:animate-fade-in focus:outline-none">
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-display text-xl font-bold text-ink">{company?.name ?? 'Opportunity'}</Dialog.Title>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-mute">
                {contact ? (
                  <><LinkedInLink url={contact.linkedin} size={13} />{contact.name}{contact.role ? ` · ${contact.role}` : ''}</>
                ) : 'No contact yet'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={opp.status} />
                {!canEdit && (
                  <span className="chip bg-surface-2 text-ink-mute"><Eye size={12} /> View only</span>
                )}
              </div>
            </div>
            <Dialog.Close className="rounded-lg p-1 text-ink-mute transition hover:bg-surface-2 hover:text-ink"><X size={18} /></Dialog.Close>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* stage + next action */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stage">
                {canEdit ? (
                  <Dropdown
                    className="w-full"
                    value={opp.status}
                    onChange={(v) => advanceStage(user, opp, v as typeof opp.status)}
                    options={OPPORTUNITY_STATUSES.map((s) => ({ value: s, label: s }))}
                  />
                ) : (
                  <div className="flex h-10 items-center rounded-xl border border-line bg-bg-elev px-3 text-sm text-ink-dim">{opp.status}</div>
                )}
              </Field>
              <Field label="Next action">
                <div className="flex h-10 items-center rounded-xl border border-line bg-bg-elev px-3 text-sm text-ink-dim">
                  {opp.nextAction ? `${opp.nextAction} · ${fmtDate(opp.nextActionDate)}` : '—'}
                </div>
              </Field>
            </div>

            {/* revenue */}
            {canEdit ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Deal value (€)">
                  <Input type="number" min={0} key={opp.value} defaultValue={opp.value} onBlur={(e) => setDealValue(user, opp, Number(e.target.value) || 0)} />
                </Field>
                <Field label="Revenue">
                  <button
                    onClick={() => setRevenueReceived(user, opp, !opp.revenueReceived)}
                    className={cn('flex h-10 w-full items-center justify-between rounded-xl border px-3 text-sm transition',
                      opp.revenueReceived ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-bg-elev text-ink-dim hover:bg-surface-2')}
                  >
                    {opp.revenueReceived ? 'Received ✓' : 'Mark as received'}
                  </button>
                </Field>
              </div>
            ) : opp.value > 0 ? (
              <div className="rounded-xl border border-line bg-bg-elev p-3 text-sm text-ink-dim">
                Deal value {fmtMoney(opp.value)} · {opp.revenueReceived ? 'Received' : 'Outstanding'}
              </div>
            ) : null}

            {/* log interaction — single clear control */}
            {canEdit && (
              <section className="rounded-2xl border border-line bg-surface p-4">
                <p className="mb-3 text-sm font-semibold text-ink">Record an interaction</p>
                <div className="flex gap-1 rounded-xl border border-line bg-bg-elev p-1">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.type}
                      onClick={() => setType(c.type)}
                      className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition',
                        type === c.type ? 'bg-brand text-white shadow-[0_2px_8px_-2px_var(--brand-soft)]' : 'text-ink-mute hover:text-ink')}
                    >
                      <c.icon size={15} /> {c.label}
                    </button>
                  ))}
                </div>

                <div className={cn('mt-3 grid gap-3', isMeeting ? 'grid-cols-1' : 'sm:grid-cols-3')}>
                  <Field label={isMeeting ? 'Meeting date' : 'Date'}>
                    <Input type="date" value={intDate || todayISO()} onChange={(e) => setIntDate(e.target.value)} />
                  </Field>
                  {!isMeeting && (
                    <>
                      <Field label="Phase">
                        <Dropdown className="w-full" value={phase} onChange={(v) => setPhase(v as 'first' | 'follow-up')}
                          options={[{ value: 'first', label: 'First contact' }, { value: 'follow-up', label: 'Follow-up' }]} />
                      </Field>
                      <Field label="Outcome">
                        <Dropdown className="w-full" value={outcome} onChange={(v) => setOutcome(v as ActivityOutcome)}
                          options={[{ value: 'positive', label: 'Positive' }, { value: 'neutral', label: 'Neutral' }, { value: 'no-response', label: 'No response' }]} />
                      </Field>
                    </>
                  )}
                </div>
                {!isMeeting && (
                  <div className="mt-3"><Textarea placeholder="Notes (optional)…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={logInteraction}>{isMeeting ? 'Log meeting' : 'Log interaction'}</Button>
                </div>
              </section>
            )}

            {/* schedule next step */}
            {canEdit && (
              <section className="rounded-2xl border border-line bg-surface p-4">
                <p className="mb-3 text-sm font-semibold text-ink">Schedule next step</p>
                <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                  <Input type="date" value={faDate} min={todayISO()} onChange={(e) => setFaDate(e.target.value)} />
                  <Input placeholder="e.g. Send proposal" value={faText} onChange={(e) => setFaText(e.target.value)} />
                  <Button size="sm" variant="secondary" disabled={!faDate || !faText}
                    onClick={() => { scheduleFollowUp(user, opp, faDate, faText); setFaDate(''); setFaText('') }}>
                    Schedule
                  </Button>
                </div>
              </section>
            )}

            {contract && (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
                <p className="font-semibold text-success">Contract</p>
                <p className="mt-1 text-ink-dim">Sent {fmtDate(contract.dateSent)} · Signed {fmtDate(contract.dateSigned)}
                  {contract.daysUntilSigned != null && ` · ${contract.daysUntilSigned}d to sign`}</p>
              </div>
            )}

            {/* timeline */}
            <section>
              <p className="mb-3 text-sm font-semibold text-ink">Activity timeline {meetings.length > 0 && <span className="text-ink-mute">· {meetings.length} meeting(s)</span>}</p>
              {timeline.length === 0 && <p className="text-sm text-ink-mute">No activity logged yet.</p>}
              <ol className="space-y-3">
                {timeline.map((a) => {
                  const Icon = TYPE_ICON[a.type] ?? MessageSquare
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full',
                        a.outcome === 'positive' ? 'bg-success/15 text-success' : a.outcome === 'no-response' ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-ink-dim')}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{a.type} <span className="text-ink-mute">· {a.phase}{a.count > 1 ? ` ×${a.count}` : ''}</span></p>
                        {a.notes && <p className="text-sm text-ink-dim">{a.notes}</p>}
                        <p className="text-xs text-ink-mute">{fmtDate(a.date)} · {relativeDays(a.date)}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
