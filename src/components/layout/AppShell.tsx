import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Spinner } from '@/components/ui/primitives'
import { Credits } from '@/components/ui/Brand'
import { OpportunityDialog } from '@/features/member/OpportunityDialog'
import { useFocus } from '@/state/focus'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const dialogOppId = useFocus((s) => s.dialogOppId)
  const closeLead = useFocus((s) => s.closeLead)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-fade-up">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-[1400px]">
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
            <footer className="mt-8 border-t border-line pt-4 lg:hidden">
              <Credits />
            </footer>
          </div>
        </main>
      </div>

      {/* Global lead detail — opened by notifications when there's no pipeline to jump to */}
      <OpportunityDialog oppId={dialogOppId} onClose={closeLead} />
    </div>
  )
}
