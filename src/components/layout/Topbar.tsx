import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut, Menu, Repeat } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { navFor, homePathFor } from '@/app/nav'
import { useDB } from '@/data/store'
import { useCurrentUser, useSession } from '@/state/session'
import { useSupabaseAuth } from '@/lib/supabase'
import { Avatar } from '@/components/ui/primitives'
import { GlobalSearch } from './GlobalSearch'
import { NotificationBell } from './NotificationBell'

// Quick demo identities so reviewers can hop between roles.
const DEMO_USERS = ['usr_admin', 'usr_pavlos', 'usr_tijs', 'usr_kobe']

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const user = useCurrentUser()
  const users = useDB((s) => s.users)
  const { login, logout } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (!user) return null

  const items = navFor(user.role)
  const active = [...items].reverse().find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
  const title = active?.label ?? 'Dashboard'

  function switchTo(id: string) {
    const target = users.find((u) => u.id === id)
    if (!target) return
    login(id)
    navigate(homePathFor(target.role))
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/95 px-4">
      <button onClick={onMenu} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-ink-dim lg:hidden">
        <Menu size={18} />
      </button>
      <h1 className="hidden font-display text-lg font-semibold text-ink md:block">{title}</h1>
      <div className="ml-auto flex flex-1 items-center justify-end gap-3">
        <div className="hidden flex-1 justify-center sm:flex">
          <GlobalSearch />
        </div>
        <NotificationBell />
        <Dropdown.Root>
          <Dropdown.Trigger className="flex items-center gap-2 rounded-xl border border-line bg-bg-elev py-1 pl-1 pr-2.5 transition hover:bg-surface-2">
            <Avatar name={user.name} size={30} />
            <ChevronDown size={14} className="text-ink-mute" />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={8} className="z-50 w-60 rounded-2xl border border-line bg-surface p-2 shadow-pop">
              <div className="px-2 py-2">
                <p className="text-sm font-medium text-ink">{user.name}</p>
                <p className="text-xs text-ink-mute">{user.email}</p>
              </div>
              <div className="my-1 h-px bg-line" />
              {!useSupabaseAuth && (
                <>
                  <p className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
                    <Repeat size={12} /> Switch identity (demo)
                  </p>
                  {DEMO_USERS.map((id) => {
                    const u = users.find((x) => x.id === id)
                    if (!u) return null
                    return (
                      <Dropdown.Item
                        key={id}
                        onSelect={() => switchTo(id)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-dim outline-none transition data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink"
                      >
                        <Avatar name={u.name} size={24} />
                        <span className="truncate">{u.name}</span>
                        <span className="ml-auto text-[10px] uppercase text-ink-mute">{u.role}</span>
                      </Dropdown.Item>
                    )
                  })}
                  <div className="my-1 h-px bg-line" />
                </>
              )}
              <Dropdown.Item
                onSelect={() => { logout(); navigate('/login') }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-danger outline-none transition data-[highlighted]:bg-danger/15"
              >
                <LogOut size={15} /> Sign out
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  )
}
