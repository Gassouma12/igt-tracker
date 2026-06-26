import { useLC } from './useLC'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/primitives'
import { Dashboard } from '@/features/shared/Dashboard'

export default function Overview() {
  const { lc, members, opportunities, activities, meetings, contracts, lcGoals } = useLC()
  if (!lc) return <Spinner />

  return (
    <div>
      <PageHeader title={lc.name} subtitle={`${members.length} members · iGT sales performance`} />
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
