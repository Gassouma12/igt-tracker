import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { AlarmClock, Bell, CalendarClock, Moon } from 'lucide-react'
import { useMemo } from 'react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { scopeOpportunities } from '@/lib/rbac'
import { notifications, type Notification } from '@/lib/metrics'
import { fmtDate } from '@/lib/format'

const ICON = {
  overdue: AlarmClock,
  'upcoming-meeting': CalendarClock,
  inactive: Moon,
}
const TONE = {
  overdue: 'text-danger',
  'upcoming-meeting': 'text-info',
  inactive: 'text-ink-mute',
}

export function NotificationBell() {
  const user = useCurrentUser()
  const opportunities = useDB((s) => s.opportunities)
  const meetings = useDB((s) => s.meetings)
  const companies = useDB((s) => s.companies)
  const users = useDB((s) => s.users)

  const items = useMemo<Notification[]>(() => {
    if (!user) return []
    const scoped = scopeOpportunities(user, opportunities, users)
    const scopedIds = new Set(scoped.map((o) => o.id))
    return notifications(scoped, meetings.filter((m) => scopedIds.has(m.opportunityId)))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 30)
  }, [user, opportunities, meetings, users])

  const companyOf = (oppId: string) => {
    const opp = opportunities.find((o) => o.id === oppId)
    return companies.find((c) => c.id === opp?.companyId)?.name ?? '—'
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-bg-elev text-ink-dim transition hover:text-ink">
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className="z-50 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-pop"
        >
          <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
            Notifications · {items.length}
          </p>
          {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-ink-mute">You're all caught up 🎉</p>}
          {items.map((n, i) => {
            const Icon = ICON[n.kind]
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                <Icon size={16} className={`mt-0.5 ${TONE[n.kind]}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{companyOf(n.opportunityId)}</p>
                  <p className="text-xs text-ink-mute">{n.label} · {fmtDate(n.date)}</p>
                </div>
              </div>
            )
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
