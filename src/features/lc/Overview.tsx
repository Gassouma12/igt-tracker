import { useLC } from './useLC'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/primitives'
import { Dashboard } from '@/features/shared/Dashboard'
import { MeetingBreakdown } from '@/features/shared/MeetingBreakdown'

export default function Overview() {
  const { lc, members, opportunities, activities, meetings, contracts, lcGoals } = useLC()
  if (!lc) return <Spinner />

  return (
    <div>
      <PageHeader title={lc.name} subtitle={`${members.length} members · iGT sales performance`} />

      <div className="mb-4">
        <MeetingBreakdown opps={opportunities} meetings={meetings} users={members} />
      </div>

      <Dashboard
        opps={opportunities}
        activities={activities}
        meetings={meetings}
        contracts={contracts}
        users={members}
        lcs={[lc]}
        goals={lcGoals}
        showLcRanking={false}
      />
    </div>
  )
}
