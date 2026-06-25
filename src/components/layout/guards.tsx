import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Role } from '@/data/types'
import { useCurrentUser } from '@/state/session'
import { homePathFor } from '@/app/nav'

/** Redirects to /login when nobody is signed in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

/** Restricts a route group to specific roles; others bounce to their home. */
export function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />
  return <>{children}</>
}
