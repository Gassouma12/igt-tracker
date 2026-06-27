import { CalendarCheck, CalendarClock } from 'lucide-react'
import { useLC } from './useLC'
import { meetingStats } from '@/lib/metrics'
import { fmtNum } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner, StatCard } from '@/components/ui/primitives'
import { Dashboard } from '@/features/shared/Dashboard'

export default function Overview() {
  const { lc, members, opportunities, activities, meetings, contracts, lcGoals } = useLC()
  if (!lc) return <Spinner />

  const mtg = meetingStats(opportunities, meetings)

  return (
    <div>
      <PageHeader title={lc.name} subtitle={`${members.length} members · iGT sales performance`} />

      <div className="mb-4 grid grid-cols-2 gap-4">
        <StatCard
          label="Meetings had" value={fmtNum(mtg.had)} icon={<CalendarCheck size={18} />}
          accent="var(--success)" hint="recorded through an interaction"
        />
        <StatCard
          label="Meetings scheduled" value={fmtNum(mtg.scheduled)} icon={<CalendarClock size={18} />}
          accent="var(--info)" hint="booked, not yet held"
        />
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
