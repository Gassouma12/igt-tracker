import { useMemo } from 'react'
import { useLC } from './useLC'
import { totalOutreaches } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Badge, Card, SectionTitle } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { RankingBars } from '@/components/charts/Charts'

const ROLE_TONE = { admin: 'brand', lcp: 'brand', lcvp: 'info', member: 'neutral' } as const

export default function Team() {
  const { members, opportunities, activities, meetings } = useLC()

  const rows = useMemo(() => {
    return members.map((m) => {
      const myOpps = opportunities.filter((o) => o.ownerId === m.id)
      const myOppIds = new Set(myOpps.map((o) => o.id))
      const myActs = activities.filter((a) => myOppIds.has(a.opportunityId))
      const myMeetings = meetings.filter((mt) => myOppIds.has(mt.opportunityId))
      const signed = myOpps.filter((o) => o.status === 'Contract signed').length
      return {
        id: m.id, name: m.name, role: m.role, position: m.position,
        outreaches: totalOutreaches(myActs), opportunities: myOpps.length,
        meetings: myMeetings.length, signed, conversion: myOpps.length ? signed / myOpps.length : 0,
      }
    }).sort((a, b) => b.outreaches - a.outreaches)
  }, [members, opportunities, activities, meetings])

  return (
    <div>
      <PageHeader title="Team" subtitle={`${members.length} members · individual performance`} />

      <Card className="mb-4">
        <SectionTitle title="Member ranking" subtitle="By total outreaches" />
        <RankingBars data={rows} dataKey="outreaches" color="var(--accent)" />
      </Card>

      <Table>
        <THead><TR><TH>Member</TH><TH>Role</TH><TH>Outreaches</TH><TH>Opportunities</TH><TH>Meetings</TH><TH>Signed</TH><TH>Conversion</TH></TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD>
                <span className="flex items-center gap-2.5">
                  <Avatar name={r.name} size={30} />
                  <span><span className="block font-medium text-ink">{r.name}</span><span className="block text-xs text-ink-mute">{r.position}</span></span>
                </span>
              </TD>
              <TD><Badge tone={ROLE_TONE[r.role]}>{r.role.toUpperCase()}</Badge></TD>
              <TD className="font-medium text-ink">{fmtNum(r.outreaches)}</TD>
              <TD>{fmtNum(r.opportunities)}</TD>
              <TD>{fmtNum(r.meetings)}</TD>
              <TD>{fmtNum(r.signed)}</TD>
              <TD>{fmtPct(r.conversion, 1)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}
