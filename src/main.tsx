import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import atom from '@/images/atom.png'
import { hydrateFromSupabase } from '@/data/repositories'
import { startRealtime } from '@/data/realtime'

// Favicon from the bundled asset URL — correct under any base path.
document.getElementById('app-favicon')?.setAttribute('href', atom)

if (import.meta.env.DEV) {
  import('@/lib/metrics.selfcheck').then((m) => m.runSelfCheck())
}

// When Supabase is configured, load live data then subscribe to realtime changes
// so edits from other users appear live. No-op when it isn't configured.
void hydrateFromSupabase().then(() => startRealtime())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
