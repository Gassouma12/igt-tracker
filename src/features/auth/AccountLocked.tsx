// Shown to a signed-in user whose account was deactivated (active === false).
// They stay authenticated but can't reach the app until an MCVP re-activates them.
import { Lock, LogOut, Mail } from 'lucide-react'
import { useSession } from '@/state/session'
import { Button } from '@/components/ui/primitives'
import { Credits } from '@/components/ui/Brand'
import type { User } from '@/data/types'

const CONTACT = 'kacem@aiesec.be'

export function AccountLocked({ user }: { user: User }) {
  const logout = useSession((s) => s.logout)

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-pop">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-danger/15 text-danger">
          <Lock size={30} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">Account temporarily locked</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Hi {user.name.split(' ')[0]}, your access has been paused. Please email{' '}
          <span className="text-ink">{CONTACT}</span> for more inquiries and to get it restored.
        </p>

        <a
          href={`mailto:${CONTACT}?subject=${encodeURIComponent('Atom account locked')}`}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-line bg-bg-elev px-4 py-3 text-sm text-ink transition hover:border-brand/40"
        >
          <Mail size={16} className="text-brand" /> Email {CONTACT}
        </a>

        <div className="mt-5 flex justify-center">
          <Button variant="ghost" onClick={logout}><LogOut size={15} /> Sign out</Button>
        </div>

        <Credits className="mt-6" />
      </div>
    </div>
  )
}
