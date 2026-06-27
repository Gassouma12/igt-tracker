import { NavLink } from 'react-router-dom'
import { navFor } from '@/app/nav'
import { useCurrentUser } from '@/state/session'
import { Avatar } from '@/components/ui/primitives'
import { BrandMark, Credits } from '@/components/ui/Brand'
import { cn } from '@/lib/cn'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', lcp: 'LC President', lcvp: 'LC VP Sales', member: 'Sales Member',
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  if (!user) return null
  const items = navFor(user.role)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-2 border-r border-line bg-bg-elev/70 px-3 py-5">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <BrandMark size={36} />
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-ink">iGT Sales</p>
          <p className="text-[11px] text-ink-mute">AIESEC in Belgium</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand/15 text-ink shadow-[inset_0_0_0_1px_var(--brand-soft)]'
                  : 'text-ink-mute hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
        <Avatar name={user.name} size={34} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-[11px] text-ink-mute">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <Credits className="mt-2" />
    </aside>
  )
}
