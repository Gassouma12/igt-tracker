import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RoleRoute } from '@/components/layout/guards'
import { Spinner } from '@/components/ui/primitives'
import { useCurrentUser } from '@/state/session'
import { homePathFor } from '@/app/nav'
import type { Role } from '@/data/types'

const Login = lazy(() => import('@/features/auth/Login'))
const GlobalDashboard = lazy(() => import('@/features/admin/GlobalDashboard'))
const LCManagement = lazy(() => import('@/features/admin/LCManagement'))
const UserManagement = lazy(() => import('@/features/admin/UserManagement'))
const Analytics = lazy(() => import('@/features/admin/Analytics'))
const Settings = lazy(() => import('@/features/admin/Settings'))
const LCOverview = lazy(() => import('@/features/lc/Overview'))
const LCPipeline = lazy(() => import('@/features/lc/Pipeline'))
const LCTeam = lazy(() => import('@/features/lc/Team'))
const LCGoals = lazy(() => import('@/features/lc/Goals'))
const LCReports = lazy(() => import('@/features/lc/Reports'))
const MyPipeline = lazy(() => import('@/features/member/MyPipeline'))
const Companies = lazy(() => import('@/features/member/Companies'))
const Activities = lazy(() => import('@/features/member/Activities'))
const Meetings = lazy(() => import('@/features/member/Meetings'))
const Performance = lazy(() => import('@/features/member/Performance'))

function RootRedirect() {
  const user = useCurrentUser()
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}

const guarded = (roles: Role[], el: React.ReactNode) => <RoleRoute roles={roles}>{el}</RoleRoute>

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          {/* Admin */}
          <Route path="/admin" element={guarded(['admin'], <GlobalDashboard />)} />
          <Route path="/admin/lcs" element={guarded(['admin'], <LCManagement />)} />
          <Route path="/admin/users" element={guarded(['admin'], <UserManagement />)} />
          <Route path="/admin/analytics" element={guarded(['admin'], <Analytics />)} />
          <Route path="/admin/settings" element={guarded(['admin'], <Settings />)} />

          {/* LC (LCP / LCVP) */}
          <Route path="/lc" element={guarded(['lcp', 'lcvp'], <LCOverview />)} />
          <Route path="/lc/pipeline" element={guarded(['lcp', 'lcvp'], <LCPipeline />)} />
          <Route path="/lc/team" element={guarded(['lcp', 'lcvp'], <LCTeam />)} />
          <Route path="/lc/goals" element={guarded(['lcp', 'lcvp'], <LCGoals />)} />
          <Route path="/lc/reports" element={guarded(['lcp', 'lcvp'], <LCReports />)} />

          {/* Member workspace */}
          <Route path="/me" element={guarded(['member', 'lcp', 'lcvp'], <MyPipeline />)} />
          <Route path="/me/companies" element={guarded(['member', 'lcp', 'lcvp'], <Companies />)} />
          <Route path="/me/activities" element={guarded(['member', 'lcp', 'lcvp'], <Activities />)} />
          <Route path="/me/meetings" element={guarded(['member', 'lcp', 'lcvp'], <Meetings />)} />
          <Route path="/me/performance" element={guarded(['member', 'lcp', 'lcvp'], <Performance />)} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  )
}
