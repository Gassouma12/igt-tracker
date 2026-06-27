import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useDB } from '@/data/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dropdown } from '@/components/ui/Dropdown'
import { Dashboard } from '@/features/shared/Dashboard'
import { MeetingBreakdown } from '@/features/shared/MeetingBreakdown'
import { useFilters } from '@/state/filters'

export default function GlobalDashboard() {
  const opportunities = useDB((s) => s.opportunities)
  const activities = useDB((s) => s.activities)
  const meetings = useDB((s) => s.meetings)
  const contracts = useDB((s) => s.contracts)
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const goals = useDB((s) => s.goals)

  const patch = useDB((s) => s.patch)
  const lcFilter = useFilters((s) => s.lcId)
  const setFilters = useFilters((s) => s.set)
  const [confirming, setConfirming] = useState(false)

  function clearSalesData() {
    patch({ companies: [], contacts: [], opportunities: [], activities: [], meetings: [], contracts: [], activityLog: [], notifications: [] })
    setConfirming(false)
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
            {confirming ? (
              <span className="flex items-center gap-2">
                <span className="text-sm text-ink-mute">Delete all sales data?</span>
                <button onClick={clearSalesData} className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90">Yes, clear</button>
                <button onClick={() => setConfirming(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-mute transition hover:text-ink">Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger transition hover:bg-danger/10">
                <Trash2 size={14} /> Reset data
              </button>
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
