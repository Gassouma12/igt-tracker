import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RoleRoute } from '@/components/layout/guards'
import { Spinner } from '@/components/ui/primitives'
import { Toaster } from '@/components/ui/Toaster'
import { useCurrentUser, useSession } from '@/state/session'
import { homePathFor } from '@/app/nav'
import type { Role } from '@/data/types'

const Login = lazy(() => import('@/features/auth/Login'))
const GlobalDashboard = lazy(() => import('@/features/admin/GlobalDashboard'))
const LCManagement = lazy(() => import('@/features/admin/LCManagement'))
const UserManagement = lazy(() => import('@/features/admin/UserManagement'))
const Approvals = lazy(() => import('@/features/admin/Approvals'))
const Analytics = lazy(() => import('@/features/admin/Analytics'))
const Settings = lazy(() => import('@/features/admin/Settings'))
const LCOverview = lazy(() => import('@/features/lc/Overview'))
const LCPipeline = lazy(() => import('@/features/lc/Pipeline'))
const LCTeam = lazy(() => import('@/features/lc/Team'))
const LCGoals = lazy(() => import('@/features/lc/Goals'))
const LCReports = lazy(() => import('@/features/lc/Reports'))
const MyPipeline = lazy(() => import('@/features/member/MyPipeline'))
const Companies = lazy(() => import('@/features/member/Companies'))
const Interactions = lazy(() => import('@/features/member/Interactions'))
const Performance = lazy(() => import('@/features/member/Performance'))
const Feedback = lazy(() => import('@/features/shared/Feedback'))

function RootRedirect() {
  const sessionId = useSession((s) => s.currentUserId)
  const user = useCurrentUser()
  // Signed in but profile still hydrating — wait instead of bouncing to /login.
  if (sessionId && !user) return <div className="grid min-h-screen place-items-center"><Spinner /></div>
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}

const guarded = (roles: Role[], el: React.ReactNode) => <RoleRoute roles={roles}>{el}</RoleRoute>

export default function App() {
  return (
    <>
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          {/* Admin */}
          <Route path="/admin" element={guarded(['admin'], <GlobalDashboard />)} />
          <Route path="/admin/lcs" element={guarded(['admin'], <LCManagement />)} />
          <Route path="/admin/users" element={guarded(['admin'], <UserManagement />)} />
          <Route path="/admin/approvals" element={guarded(['admin'], <Approvals />)} />
          <Route path="/admin/analytics" element={guarded(['admin'], <Analytics />)} />
          <Route path="/admin/settings" element={guarded(['admin'], <Settings />)} />

          {/* LC (LCP / LCVP / Team Leader — Team Leader is scoped to their team) */}
          <Route path="/lc" element={guarded(['lcp', 'lcvp', 'team_leader'], <LCOverview />)} />
          <Route path="/lc/pipeline" element={guarded(['lcp', 'lcvp', 'team_leader'], <LCPipeline />)} />
          <Route path="/lc/team" element={guarded(['lcp', 'lcvp', 'team_leader'], <LCTeam />)} />
          <Route path="/lc/goals" element={guarded(['admin', 'lcp', 'lcvp', 'team_leader', 'member'], <LCGoals />)} />
          <Route path="/lc/reports" element={guarded(['lcp', 'lcvp', 'team_leader'], <LCReports />)} />

          {/* Member workspace (everyone who sells runs their own pipeline) */}
          <Route path="/me" element={guarded(['member', 'team_leader', 'lcp', 'lcvp', 'admin'], <MyPipeline />)} />
          <Route path="/me/companies" element={guarded(['member', 'team_leader', 'lcp', 'lcvp', 'admin'], <Companies />)} />
          <Route path="/me/interactions" element={guarded(['member', 'team_leader', 'lcp', 'lcvp', 'admin'], <Interactions />)} />
          <Route path="/me/performance" element={guarded(['member', 'team_leader', 'lcp', 'lcvp', 'admin'], <Performance />)} />

          {/* Feedback — reachable by every role */}
          <Route path="/feedback" element={<Feedback />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
    <Toaster />
    </>
  )
}
