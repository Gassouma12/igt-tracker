import { useMemo, useState } from 'react'
import { Eraser, Sparkles } from 'lucide-react'
import { useDB } from '@/data/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dropdown } from '@/components/ui/Dropdown'
import { Dashboard } from '@/features/shared/Dashboard'
import { MeetingBreakdown } from '@/features/shared/MeetingBreakdown'
import { useFilters } from '@/state/filters'
import { isSupabaseConfigured } from '@/lib/supabase'
import { generateMockData, resetMockData } from '@/data/mockData'
import { toast } from '@/lib/toast'

export default function GlobalDashboard() {
  const opportunities = useDB((s) => s.opportunities)
  const activities = useDB((s) => s.activities)
  const meetings = useDB((s) => s.meetings)
  const contracts = useDB((s) => s.contracts)
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const goals = useDB((s) => s.goals)

  const lcFilter = useFilters((s) => s.lcId)
  const setFilters = useFilters((s) => s.set)
  const [mockBusy, setMockBusy] = useState<false | 'gen' | 'reset'>(false)

  async function addMockData() {
    setMockBusy('gen')
    try {
      const r = await generateMockData()
      toast.success(`Added demo data — ${r.users} members, ${r.opportunities} opportunities across the LCs.`)
    } catch (e) {
      toast.error(`Could not add demo data: ${(e as Error).message}`)
    } finally { setMockBusy(false) }
  }

  async function clearMockData() {
    setMockBusy('reset')
    try {
      await resetMockData()
      toast.info('Demo data cleared — real users kept.')
    } catch (e) {
      toast.error(`Could not clear demo data: ${(e as Error).message}`)
    } finally { setMockBusy(false) }
  }

  const scoped = useMemo(() => {
    const opps = lcFilter ? opportunities.filter((o) => o.lcId === lcFilter) : opportunities
    const oppIds = new Set(opps.map((o) => o.id))
    return {
      opps,
      activities: activities.filter((a) => oppIds.has(a.opportunityId)),
      meetings: meetings.filter((m) => oppIds.has(m.opportunityId)),
      contracts: contracts.filter((c) => oppIds.has(c.opportunityId)),
      goals: goals.filter((g) => (lcFilter ? g.scope === 'lc' && g.lcId === lcFilter : g.scope === 'global')),
    }
  }, [opportunities, activities, meetings, contracts, goals, lcFilter])

  return (
    <div>
      <PageHeader
        title="Global Dashboard"
        subtitle="All Local Committees · iGT sales performance"
        actions={
          <>
            <Dropdown
              className="w-48"
              ariaLabel="Filter by Local Committee"
              value={lcFilter ?? ''}
              onChange={(v) => setFilters({ lcId: v || null })}
              options={[{ value: '', label: 'All LCs' }, ...lcs.map((lc) => ({ value: lc.id, label: lc.name }))]}
            />
            {isSupabaseConfigured && (
              // Temporary demo tools: populate / clear mock data across the LCs.
              <>
                <button
                  onClick={addMockData}
                  disabled={!!mockBusy}
                  title="Fill every LC with demo members, pipeline, meetings & contracts"
                  className="flex items-center gap-1.5 rounded-lg border border-brand/40 px-3 py-1.5 text-sm text-brand transition hover:bg-brand/10 disabled:opacity-50"
                >
                  <Sparkles size={14} /> {mockBusy === 'gen' ? 'Adding…' : 'Add demo data'}
                </button>
                <button
                  onClick={clearMockData}
                  disabled={!!mockBusy}
                  title="Remove all demo data (keeps real users)"
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-mute transition hover:text-ink disabled:opacity-50"
                >
                  <Eraser size={14} /> {mockBusy === 'reset' ? 'Clearing…' : 'Clear demo'}
                </button>
              </>
            )}
          </>
        }
      />
      <div className="mb-4">
        <MeetingBreakdown opps={scoped.opps} meetings={scoped.meetings} users={users} />
      </div>

      <Dashboard
        opps={scoped.opps}
        activities={scoped.activities}
        meetings={scoped.meetings}
        contracts={scoped.contracts}
        users={users}
        lcs={lcs}
        goals={scoped.goals}
        showLcRanking={!lcFilter}
      />
    </div>
  )
}
