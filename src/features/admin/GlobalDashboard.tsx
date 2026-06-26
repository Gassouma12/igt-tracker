import { useMemo } from 'react'
import { Filter } from 'lucide-react'
import { useDB } from '@/data/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Field'
import { Dashboard } from '@/features/shared/Dashboard'
import { useFilters } from '@/state/filters'

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
          <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-elev px-3">
            <Filter size={15} className="text-ink-mute" />
            <Select
              className="border-0 bg-transparent px-1 focus:ring-0"
              value={lcFilter ?? ''}
              onChange={(e) => setFilters({ lcId: e.target.value || null })}
            >
              <option value="">All LCs</option>
              {lcs.map((lc) => <option key={lc.id} value={lc.id}>{lc.name}</option>)}
            </Select>
          </div>
        }
      />
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
