import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RoleRoute } from '@/components/layout/guards'
import { ComingSoon } from '@/components/ui/ComingSoon'
import { Spinner } from '@/components/ui/primitives'
import { useCurrentUser } from '@/state/session'
import { homePathFor } from '@/app/nav'
import type { Role } from '@/data/types'

const Login = lazy(() => import('@/features/auth/Login'))
const GlobalDashboard = lazy(() => import('@/features/admin/GlobalDashboard'))
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
          <Route path="/admin/lcs" element={guarded(['admin'], <ComingSoon title="LC Management" note="Create and edit Local Committees, assign LCPs/LCVPs, set per-LC goals." />)} />
          <Route path="/admin/users" element={guarded(['admin'], <ComingSoon title="User Management" note="Manage members across all LCs — roles, assignment, active status." />)} />
          <Route path="/admin/analytics" element={guarded(['admin'], <ComingSoon title="Analytics" note="Deep-dive cross-LC analytics and exportable reports." />)} />
          <Route path="/admin/settings" element={guarded(['admin'], <ComingSoon title="Settings" note="Platform configuration and Supabase connection." />)} />

          {/* LC (LCP / LCVP) */}
          <Route path="/lc" element={guarded(['lcp', 'lcvp'], <ComingSoon title="LC Overview" note="Team performance, pipeline and goals for your Local Committee." />)} />
          <Route path="/lc/pipeline" element={guarded(['lcp', 'lcvp'], <ComingSoon title="LC Pipeline" />)} />
          <Route path="/lc/team" element={guarded(['lcp', 'lcvp'], <ComingSoon title="Team" note="Individual member performance within your LC." />)} />
          <Route path="/lc/goals" element={guarded(['lcp', 'lcvp'], <ComingSoon title="Goals" />)} />
          <Route path="/lc/reports" element={guarded(['lcp', 'lcvp'], <ComingSoon title="Reports" />)} />

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
