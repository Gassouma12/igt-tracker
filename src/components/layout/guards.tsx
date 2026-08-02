import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Role } from '@/data/types'
import { useCurrentUser, useSession } from '@/state/session'
import { homePathFor } from '@/app/nav'
import { AccountPending } from '@/features/auth/AccountPending'
import { Spinner } from '@/components/ui/primitives'

const FullPageSpinner = () => <div className="grid min-h-screen place-items-center"><Spinner /></div>

/** Redirects to /login when nobody is signed in; gates unapproved accounts. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const sessionId = useSession((s) => s.currentUserId)
  const user = useCurrentUser()
  const location = useLocation()
  if (!sessionId) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  // Signed in, but the profile row hasn't hydrated yet (first load after login).
  // Wait rather than bouncing to /login — that was the "log in twice" bug.
  if (!user) return <FullPageSpinner />
  // Seeded users have no status field => treated as approved.
  if ((user.status ?? 'approved') !== 'approved') return <AccountPending user={user} />
  return <>{children}</>
}

/** Restricts a route group to specific roles; others bounce to their home. */
export function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const sessionId = useSession((s) => s.currentUserId)
  const user = useCurrentUser()
  if (!sessionId) return <Navigate to="/login" replace />
  if (!user) return <FullPageSpinner />
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />
  return <>{children}</>
}
