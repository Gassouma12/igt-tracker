import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { AlarmClock, Bell, CalendarClock, CheckCheck, Handshake, Moon, Target, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { useFocus } from '@/state/focus'
import { markAllNotificationsRead, markNotificationRead } from '@/data/actions'
import { scopeOpportunities } from '@/lib/rbac'
import { reminders, type Reminder } from '@/lib/metrics'
import { fmtDate, relativeDays } from '@/lib/format'
import { cn } from '@/lib/cn'

const REMINDER_ICON = { overdue: AlarmClock, 'upcoming-meeting': CalendarClock, inactive: Moon }
const REMINDER_TONE = { overdue: 'text-danger', 'upcoming-meeting': 'text-info', inactive: 'text-ink-mute' }

export function NotificationBell() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setHighlight = useFocus((s) => s.setHighlight)
  const openLead = useFocus((s) => s.openLead)

  const notifications = useDB((s) => s.notifications)
  const opportunities = useDB((s) => s.opportunities)
  const meetings = useDB((s) => s.meetings)
  const companies = useDB((s) => s.companies)
  const users = useDB((s) => s.users)

  const myNotifs = useMemo(
    () => notifications.filter((n) => n.recipientId === user?.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    [notifications, user],
  )
  const unread = myNotifs.filter((n) => !n.read).length

  const myReminders = useMemo<Reminder[]>(() => {
    if (!user) return []
    const scoped = scopeOpportunities(user, opportunities, users)
    const ids = new Set(scoped.map((o) => o.id))
    return reminders(scoped, meetings.filter((m) => ids.has(m.opportunityId)))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 20)
  }, [user, opportunities, meetings, users])

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
      <Dropdown.Trigger className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-bg-elev text-ink-dim transition hover:text-ink">
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : myReminders.length > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" />
        ) : null}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end" sideOffset={8}
          className="z-50 max-h-[72vh] w-[22rem] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-pop"
        >
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
              Notifications{unread > 0 ? ` · ${unread} new` : ''}
            </p>
            {unread > 0 && user && (
              <button
                onClick={() => markAllNotificationsRead(user.id)}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-ink-mute transition hover:bg-surface-2 hover:text-ink"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {myNotifs.length === 0 && myReminders.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-ink-mute">You're all caught up 🎉</p>
          )}

          {myNotifs.map((n) => {
            const Icon = n.kind === 'contract' ? Handshake : n.kind === 'goal' ? Target : Users
            const tone = n.kind === 'contract' ? 'text-success' : n.kind === 'goal' ? 'text-brand' : 'text-info'
            return (
              <Dropdown.Item
                key={n.id}
                onSelect={() => {
                  markNotificationRead(n.id)
                  if (n.kind === 'goal') navigate('/me/performance')
                  else if (n.opportunityId) focusLead(n.opportunityId)
                }}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 outline-none transition data-[highlighted]:bg-surface-2',
                  !n.read && 'bg-brand/5',
                )}
              >
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                <Icon size={16} className={cn('mt-0.5 shrink-0', tone, n.read && 'opacity-60')} />
                <div className="min-w-0">
                  <p className={cn('text-sm', n.read ? 'text-ink-dim' : 'font-medium text-ink')}>{n.message}</p>
                  <p className="text-xs text-ink-mute">{relativeDays(n.at)}</p>
                </div>
              </Dropdown.Item>
            )
          })}

          {myReminders.length > 0 && (
            <>
              <p className="mt-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Reminders</p>
              {myReminders.map((r, i) => {
                const Icon = REMINDER_ICON[r.kind]
                return (
                  <Dropdown.Item
                    key={i}
                    onSelect={() => focusLead(r.opportunityId)}
                    className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 outline-none transition data-[highlighted]:bg-surface-2"
                  >
                    <Icon size={15} className={cn('mt-0.5 shrink-0', REMINDER_TONE[r.kind])} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{companyOf(r.opportunityId)}</p>
                      <p className="text-xs text-ink-mute">{r.label} · {fmtDate(r.date)}</p>
                    </div>
                  </Dropdown.Item>
                )
              })}
            </>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
