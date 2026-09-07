import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { BadgeEuro, Bell, CheckCheck, Handshake, Target, Trash2, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { useFocus } from '@/state/focus'
import { clearAllNotifications, deleteNotification, markAllNotificationsRead, markNotificationRead } from '@/data/actions'
import { relativeDays } from '@/lib/format'
import { cn } from '@/lib/cn'

export function NotificationBell() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setHighlight = useFocus((s) => s.setHighlight)
  const openLead = useFocus((s) => s.openLead)

  const notifications = useDB((s) => s.notifications)

  const myNotifs = useMemo(
    () => notifications.filter((n) => n.recipientId === user?.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    [notifications, user],
  )
  const unread = myNotifs.filter((n) => !n.read).length

  function focusLead(oppId: string) {
    const path = user?.role === 'member' ? '/me'
      : (user?.role === 'lcp' || user?.role === 'lcvp') ? '/lc/pipeline' : null
    if (path) { setHighlight(oppId); navigate(path) } else openLead(oppId)
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-bg-elev text-ink-dim transition hover:text-ink" title="Notifications">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
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
              Notifications{unread > 0 ? ` · ${unread} new` : ''}
            </p>
            <div className="flex items-center gap-1">
              {unread > 0 && user && (
                <button
                  onClick={() => markAllNotificationsRead(user.id)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-ink-mute transition hover:bg-surface-2 hover:text-ink"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              {myNotifs.length > 0 && user && (
                <button
                  onClick={() => { if (confirm('Delete all your notifications?')) clearAllNotifications(user.id) }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-ink-mute transition hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={13} /> Clear all
                </button>
              )}
            </div>
          </div>

          {myNotifs.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-ink-mute">You're all caught up 🎉</p>
          )}

          {myNotifs.map((n) => {
            const Icon = n.kind === 'contract' ? Handshake : n.kind === 'goal' ? Target : n.kind === 'revenue' ? BadgeEuro : Users
            const tone = n.kind === 'contract' ? 'text-success' : n.kind === 'goal' ? 'text-brand' : n.kind === 'revenue' ? 'text-success' : 'text-info'
            return (
              // The delete button sits OUTSIDE the Dropdown.Item, otherwise a click
              // on it also fires the item's navigate-on-select (Radix owns the item
              // click and stopPropagation on a child doesn't prevent it).
              <div key={n.id} className={cn('group flex items-stretch gap-1 rounded-xl pr-1', !n.read && 'bg-brand/5')}>
                <Dropdown.Item
                  onSelect={() => {
                    markNotificationRead(n.id)
                    // Account-approval requests go to the Approvals queue, not Performance.
                    if (n.kind === 'goal') {
                      navigate(n.message.toLowerCase().includes('approval needed') ? '/admin/approvals' : '/me/performance')
                    } else if (n.opportunityId) focusLead(n.opportunityId)
                  }}
                  className="flex flex-1 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 outline-none transition data-[highlighted]:bg-surface-2"
                >
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  <Icon size={16} className={cn('mt-0.5 shrink-0', tone, n.read && 'opacity-60')} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', n.read ? 'text-ink-dim' : 'font-medium text-ink')}>{n.message}</p>
                    <p className="text-xs text-ink-mute">{relativeDays(n.at)}</p>
                  </div>
                </Dropdown.Item>
                {/* Delete this notification — for me and from the database. */}
                <button
                  onClick={() => { if (user) deleteNotification(user, n.id) }}
                  className="my-1 shrink-0 self-center rounded-lg p-1.5 text-ink-mute opacity-0 transition hover:bg-danger/10 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                  title="Delete notification"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
