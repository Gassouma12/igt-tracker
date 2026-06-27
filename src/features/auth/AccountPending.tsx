// Shown to a signed-in user whose account hasn't been approved yet (or was
// rejected). Blocks the app until an admin (MCVP) approves them.

import { Clock, LogOut, Mail, RefreshCw, ShieldX } from 'lucide-react'
import { useSession } from '@/state/session'
import { Button } from '@/components/ui/primitives'
import type { User } from '@/data/types'

const CONTACT = 'kacem@aiesec.be'

export function AccountPending({ user }: { user: User }) {
  const logout = useSession((s) => s.logout)
  const rejected = user.status === 'rejected'

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-pop">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${rejected ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
          {rejected ? <ShieldX size={30} /> : <Clock size={30} />}
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">
          {rejected ? 'Account not approved' : 'Account pending approval'}
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          {rejected
            ? 'Your access request was declined. If you think this is a mistake, reach out below.'
            : `Thanks for signing up, ${user.name.split(' ')[0]}. An MCVP needs to approve your account before you can access the platform.`}
        </p>

        <a
          href={`mailto:${CONTACT}?subject=iGT%20account%20access`}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-line bg-bg-elev px-4 py-3 text-sm text-ink transition hover:border-brand/40"
        >
          <Mail size={16} className="text-brand" /> Questions? {CONTACT}
        </a>

        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={15} /> Check again
          </Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut size={15} /> Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
