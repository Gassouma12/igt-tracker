// Reminders live in their own bell, separate from the stored notifications. These
// are DERIVED (not stored): overdue follow-ups, meetings in the next 7 days, and
// leads gone quiet for 21+ days — recomputed from the user's scoped pipeline.

import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { AlarmClock, CalendarClock, Moon } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { useFocus } from '@/state/focus'
import { scopeOpportunities } from '@/lib/rbac'
import { reminders, type Reminder } from '@/lib/metrics'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/cn'

const ICON = { overdue: AlarmClock, 'upcoming-meeting': CalendarClock, inactive: Moon }
const TONE = { overdue: 'text-danger', 'upcoming-meeting': 'text-info', inactive: 'text-ink-mute' }

export function RemindersBell() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setHighlight = useFocus((s) => s.setHighlight)
  const openLead = useFocus((s) => s.openLead)

  const opportunities = useDB((s) => s.opportunities)
  const meetings = useDB((s) => s.meetings)
  const companies = useDB((s) => s.companies)
  const users = useDB((s) => s.users)

  const myReminders = useMemo<Reminder[]>(() => {
    if (!user) return []
    const scoped = scopeOpportunities(user, opportunities, users)
    const ids = new Set(scoped.map((o) => o.id))
    return reminders(scoped, meetings.filter((m) => ids.has(m.opportunityId)))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 30)
  }, [user, opportunities, meetings, users])

  const overdue = myReminders.filter((r) => r.kind === 'overdue').length
  const count = myReminders.length

  const companyOf = (oppId: string) => {
    const opp = opportunities.find((o) => o.id === oppId)
    return companies.find((c) => c.id === opp?.companyId)?.name ?? '—'
  }

  function focusLead(oppId: string) {
    const path = user?.role === 'member' ? '/me'
      : (user?.role === 'lcp' || user?.role === 'lcvp') ? '/lc/pipeline' : null
    if (path) { setHighlight(oppId); navigate(path) } else openLead(oppId)
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-bg-elev text-ink-dim transition hover:text-ink"
        title="Reminders"
      >
        <AlarmClock size={18} />
        {count > 0 && (
          <span className={cn(
            'absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold text-white',
            overdue > 0 ? 'bg-danger' : 'bg-warning',
          )}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end" sideOffset={8}
          className="z-50 max-h-[72vh] w-[22rem] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-pop"
        >
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
              Reminders{count > 0 ? ` · ${count}` : ''}
            </p>
            {overdue > 0 && <span className="chip bg-danger/15 text-danger">{overdue} overdue</span>}
          </div>

          {count === 0 && (
            <p className="px-2 py-6 text-center text-sm text-ink-mute">Nothing needs chasing right now 👌</p>
          )}

          {myReminders.map((r, i) => {
            const Icon = ICON[r.kind]
            return (
              <Dropdown.Item
                key={i}
                onSelect={() => focusLead(r.opportunityId)}
                className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 outline-none transition data-[highlighted]:bg-surface-2"
              >
                <Icon size={15} className={cn('mt-0.5 shrink-0', TONE[r.kind])} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{companyOf(r.opportunityId)}</p>
                  <p className="text-xs text-ink-mute">{r.label} · {fmtDate(r.date)}</p>
                </div>
              </Dropdown.Item>
            )
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
