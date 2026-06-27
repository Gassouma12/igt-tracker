import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { hydrateFromSupabase } from '@/data/repositories'

if (import.meta.env.DEV) {
  import('@/lib/metrics.selfcheck').then((m) => m.runSelfCheck())
}

// When Supabase is configured, replace the seeded mock data with live data.
// No-op (and instant) when it isn't — the app renders on mock data either way.
void hydrateFromSupabase()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
