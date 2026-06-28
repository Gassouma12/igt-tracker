import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { useLC } from './useLC'
import { useCurrentUser } from '@/state/session'
import { updateUser } from '@/data/actions'
import { canAssignMembers } from '@/lib/rbac'
import { followupCount, outreachCount } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Badge, Card, SectionTitle } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { RankingBars } from '@/components/charts/Charts'
import { MemberPipelineModal } from '@/features/shared/MemberPipelineModal'
import type { User } from '@/data/types'

const ROLE_TONE = { admin: 'brand', lcp: 'brand', lcvp: 'info', member: 'neutral' } as const

export default function Team() {
  const { members, opportunities, activities, meetings } = useLC()
  const actor = useCurrentUser()
  const [viewing, setViewing] = useState<User | null>(null)
  const memberById = (id: string) => members.find((m) => m.id === id) ?? null

  const canAssign = !!actor && canAssignMembers(actor)
  // Team leads members can be assigned to = the LC's VPs (and LCP).
  const leads = useMemo(() => members.filter((m) => m.role === 'lcvp' || m.role === 'lcp'), [members])
  const leadOptions = [{ value: '', label: 'Unassigned' }, ...leads.map((l) => ({ value: l.id, label: l.name }))]

  const rows = useMemo(() => {
    return members.map((m) => {
      const myOpps = opportunities.filter((o) => o.ownerId === m.id)
      const myOppIds = new Set(myOpps.map((o) => o.id))
      const myActs = activities.filter((a) => myOppIds.has(a.opportunityId))
      const myMeetings = meetings.filter((mt) => myOppIds.has(mt.opportunityId))
      const signed = myOpps.filter((o) => o.status === 'Contract signed').length
      return {
        id: m.id, name: m.name, role: m.role, position: m.position, teamLeadId: m.teamLeadId,
        outreaches: outreachCount(myActs, myOpps), followups: followupCount(myActs), opportunities: myOpps.length,
        meetings: myMeetings.length, signed, conversion: myOpps.length ? signed / myOpps.length : 0,
      }
    }).sort((a, b) => b.outreaches - a.outreaches)
  }, [members, opportunities, activities, meetings])

  return (
    <div>
      <PageHeader title="Team" subtitle={`${members.length} members · click a member to view their pipeline`} />

      <Card className="mb-4">
        <SectionTitle title="Member ranking" subtitle="By companies reached" />
        <RankingBars data={rows} dataKey="outreaches" color="var(--accent)" />
      </Card>

      <Table>
        <THead><TR><TH>Member</TH><TH>Role</TH><TH>Assigned to</TH><TH>Outreaches</TH><TH>Follow-ups</TH><TH>Opportunities</TH><TH>Meetings</TH><TH>Signed</TH><TH>Conversion</TH><TH></TH></TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id} onClick={() => setViewing(memberById(r.id))}>
              <TD>
                <span className="flex items-center gap-2.5">
                  <Avatar name={r.name} size={30} />
                  <span><span className="block font-medium text-ink">{r.name}</span><span className="block text-xs text-ink-mute">{r.position}</span></span>
                </span>
              </TD>
              <TD><Badge tone={ROLE_TONE[r.role]}>{r.role.toUpperCase()}</Badge></TD>
              <TD>
                <div onClick={(e) => e.stopPropagation()}>
                  {r.role === 'member' ? (
                    canAssign ? (
                      <Dropdown
                        size="sm" className="w-36"
                        value={r.teamLeadId ?? ''}
                        onChange={(v) => actor && updateUser(actor, r.id, { teamLeadId: v || null })}
                        options={leadOptions.filter((o) => o.value !== r.id)}
                      />
                    ) : (
                      <span className="text-ink-dim">{memberById(r.teamLeadId ?? '')?.name ?? '—'}</span>
                    )
                  ) : <span className="text-ink-mute">—</span>}
                </div>
              </TD>
              <TD className="font-medium text-ink">{fmtNum(r.outreaches)}</TD>
              <TD>{fmtNum(r.followups)}</TD>
              <TD>{fmtNum(r.opportunities)}</TD>
              <TD>{fmtNum(r.meetings)}</TD>
              <TD>{fmtNum(r.signed)}</TD>
              <TD>{fmtPct(r.conversion, 1)}</TD>
              <TD><span className="flex items-center gap-1 text-xs text-ink-mute"><Eye size={13} /> View</span></TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <MemberPipelineModal member={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
