import { useMemo } from 'react'
import { useDB } from '@/data/store'
import { performanceByLC, timeline, totalOutreaches } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Progress, SectionTitle } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { TimelineArea } from '@/components/charts/Charts'
import { DuplicatesPanel } from '@/features/shared/DuplicatesPanel'
import type { ActivityType } from '@/data/types'

const CHANNELS: ActivityType[] = ['LinkedIn', 'Email', 'Cold call', 'Meeting']

export default function Analytics() {
  const opportunities = useDB((s) => s.opportunities)
  const activities = useDB((s) => s.activities)
  const meetings = useDB((s) => s.meetings)
  const contracts = useDB((s) => s.contracts)
  const lcs = useDB((s) => s.localCommittees)
  const companies = useDB((s) => s.companies)

  const d = useMemo(() => {
    const byLC = performanceByLC(opportunities, activities, meetings, lcs)
    const total = totalOutreaches(activities)
    const channelMix = CHANNELS.map((type) => ({
      type,
      count: totalOutreaches(activities.filter((a) => a.type === type)),
    }))
    const channelTotal = channelMix.reduce((a, b) => a + b.count, 0) || 1
    return { byLC, total, tl: timeline(activities, meetings, contracts), channelMix, channelTotal }
  }, [opportunities, activities, meetings, contracts, lcs])

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Cross-LC sales analytics" />

      <DuplicatesPanel companies={companies} opportunities={opportunities} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="LC comparison" subtitle="Outreaches, meetings, contracts & conversion" />
          <Table>
            <THead><TR><TH>LC</TH><TH>Outreaches</TH><TH>Meetings</TH><TH>Signed</TH><TH>Conversion</TH></TR></THead>
            <TBody>
              {d.byLC.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-ink">{r.name}</TD>
                  <TD>{fmtNum(r.outreaches)}</TD>
                  <TD>{fmtNum(r.meetings)}</TD>
                  <TD>{fmtNum(r.signed)}</TD>
                  <TD>{fmtPct(r.conversion, 1)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <SectionTitle title="Channel mix" subtitle="Outreach volume by channel" />
          <div className="space-y-4 pt-2">
            {d.channelMix.map((c) => (
              <div key={c.type}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-dim">{c.type}</span>
                  <span className="text-ink-mute">{fmtNum(c.count)} · {fmtPct(c.count / d.channelTotal)}</span>
                </div>
                <Progress value={c.count / d.channelTotal} tone="brand" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle title="Activity trend" subtitle="Monthly outreaches & meetings across all LCs" />
        <TimelineArea data={d.tl} />
      </Card>
    </div>
  )
}
