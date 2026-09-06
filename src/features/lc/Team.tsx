import { useMemo, useState } from 'react'
import { Crown, Eye, UserRound, Users } from 'lucide-react'
import { useLC } from './useLC'
import { useCurrentUser } from '@/state/session'
import { updateUser } from '@/data/actions'
import { canAssignMembers } from '@/lib/rbac'
import { followupCount, outreachCount } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Badge, Card, EmptyState, SectionTitle } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { RankingBars } from '@/components/charts/Charts'
import { MemberInfoModal } from '@/features/shared/MemberInfoModal'
import type { Activity, Meeting, Opportunity, User } from '@/data/types'

const ROLE_TONE = { admin: 'brand', lcp: 'brand', lcvp: 'info', team_leader: 'info', member: 'neutral' } as const

interface Stat {
  id: string; name: string; role: User['role']; position: string; teamLeadId: string | null
  outreaches: number; followups: number; opportunities: number; meetings: number; signed: number; conversion: number
}

function statFor(m: User, opps: Opportunity[], activities: Activity[], meetings: Meeting[]): Stat {
  const myOpps = opps.filter((o) => o.ownerId === m.id)
  const myOppIds = new Set(myOpps.map((o) => o.id))
  const myActs = activities.filter((a) => myOppIds.has(a.opportunityId))
  const myMeetings = meetings.filter((mt) => myOppIds.has(mt.opportunityId))
  const signed = myOpps.filter((o) => o.status === 'Contract signed').length
  return {
    id: m.id, name: m.name, role: m.role, position: m.position, teamLeadId: m.teamLeadId,
    outreaches: outreachCount(myActs, myOpps), followups: followupCount(myActs), opportunities: myOpps.length,
    meetings: myMeetings.length, signed, conversion: myOpps.length ? signed / myOpps.length : 0,
  }
}

export default function Team() {
  const { members, opportunities, activities, meetings } = useLC()
  const actor = useCurrentUser()
  const [viewing, setViewing] = useState<User | null>(null)
  const memberById = (id: string) => members.find((m) => m.id === id) ?? null

  const canAssign = !!actor && canAssignMembers(actor)
  const teamLeaders = useMemo(() => members.filter((m) => m.role === 'team_leader'), [members])
  const leadOptions = [{ value: '', label: 'Unassigned' }, ...teamLeaders.map((l) => ({ value: l.id, label: l.name }))]
  const lcvpSelfOptions = [{ value: '', label: 'Unassigned' }, ...(actor ? [{ value: actor.id, label: `${actor.name} (you)` }] : [])]

  const stat = useMemo(() => {
    const map = new Map<string, Stat>()
    for (const m of members) map.set(m.id, statFor(m, opportunities, activities, meetings))
    return map
  }, [members, opportunities, activities, meetings])

  // For the whole-LC ranking chart.
  const ranking = useMemo(
    () => [...stat.values()].filter((s) => s.role === 'member' || s.role === 'team_leader').sort((a, b) => b.outreaches - a.outreaches),
    [stat],
  )

  // ---- grouping: leadership, one card per team leader, then the unassigned ----
  const leadership = useMemo(
    () => members.filter((m) => m.role === 'lcp' || m.role === 'lcvp').sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  )
  const tlIds = useMemo(() => new Set(teamLeaders.map((l) => l.id)), [teamLeaders])
  const groups = useMemo(
    () => teamLeaders
      .map((leader) => ({
        leader,
        team: members.filter((m) => m.role === 'member' && m.teamLeadId === leader.id).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.leader.name.localeCompare(b.leader.name)),
    [teamLeaders, members],
  )
  const unassigned = useMemo(
    () => members.filter((m) => m.role === 'member' && (!m.teamLeadId || !tlIds.has(m.teamLeadId))).sort((a, b) => a.name.localeCompare(b.name)),
    [members, tlIds],
  )

  const memberCols = (
    <THead><TR>
      <TH>Member</TH><TH>Assigned to</TH><TH>Outreaches</TH><TH>Follow-ups</TH>
      <TH>Opportunities</TH><TH>Meetings</TH><TH>Signed</TH><TH>Conversion</TH><TH></TH>
    </TR></THead>
  )

  const memberRow = (m: User) => {
    const s = stat.get(m.id)
    if (!s) return null
    return (
      <TR key={m.id} onClick={() => setViewing(m)}>
        <TD>
          <span className="flex items-center gap-2.5">
            <Avatar name={m.name} size={30} />
            <span><span className="block font-medium text-ink">{m.name}</span><span className="block text-xs text-ink-mute">{m.position}</span></span>
          </span>
        </TD>
        <TD>
          <div onClick={(e) => e.stopPropagation()}>
            {canAssign ? (
              <Dropdown
                size="sm" className="w-36"
                value={m.teamLeadId ?? ''}
                onChange={(v) => actor && updateUser(actor, m.id, { teamLeadId: v || null })}
                options={leadOptions.filter((o) => o.value !== m.id)}
              />
            ) : (
              <span className="text-ink-dim">{memberById(m.teamLeadId ?? '')?.name ?? '—'}</span>
            )}
          </div>
        </TD>
        <TD className="font-medium text-ink">{fmtNum(s.outreaches)}</TD>
        <TD>{fmtNum(s.followups)}</TD>
        <TD>{fmtNum(s.opportunities)}</TD>
        <TD>{fmtNum(s.meetings)}</TD>
        <TD>{fmtNum(s.signed)}</TD>
        <TD>{fmtPct(s.conversion, 1)}</TD>
        <TD><span className="flex items-center gap-1 text-xs text-ink-mute"><Eye size={13} /> Profile</span></TD>
      </TR>
    )
  }

  return (
    <div>
      <PageHeader title="Team" subtitle={`${members.length} people · grouped by team leader · click anyone to see their profile`} />

      <Card className="mb-4">
        <SectionTitle title="Member ranking" subtitle="By companies reached · whole scope" />
        <RankingBars data={ranking} dataKey="outreaches" color="var(--accent)" />
      </Card>

      {/* Leadership (LCP / LCVP) */}
      {leadership.length > 0 && (
        <Card className="mb-4">
          <SectionTitle title="LC leadership" subtitle="Presidents & VPs" />
          <div className="flex flex-wrap gap-2">
            {leadership.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewing(m)}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-brand/40"
              >
                <Avatar name={m.name} size={30} />
                <span>
                  <span className="block text-sm font-medium text-ink">{m.name}</span>
                  <span className="block text-xs text-ink-mute">{m.position}</span>
                </span>
                <Badge tone={ROLE_TONE[m.role]} className="ml-1">{m.role.toUpperCase()}</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* One card per team leader */}
      <div className="space-y-4">
        {groups.map(({ leader, team }) => {
          const ls = stat.get(leader.id)
          const teamOutreach = team.reduce((n, m) => n + (stat.get(m.id)?.outreaches ?? 0), (ls?.outreaches ?? 0))
          const teamSigned = team.reduce((n, m) => n + (stat.get(m.id)?.signed ?? 0), (ls?.signed ?? 0))
          const teamMeetings = team.reduce((n, m) => n + (stat.get(m.id)?.meetings ?? 0), (ls?.meetings ?? 0))
          return (
            <Card key={leader.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => setViewing(leader)} className="flex items-center gap-3 text-left">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-info/15 text-info"><Crown size={20} /></span>
                  <span>
                    <span className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                      {leader.name} <Badge tone="info">TEAM LEADER</Badge>
                    </span>
                    <span className="text-sm text-ink-mute">{team.length} member{team.length === 1 ? '' : 's'} · {leader.position}</span>
                  </span>
                </button>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-ink-mute">Outreaches <span className="font-semibold text-ink">{fmtNum(teamOutreach)}</span></span>
                  <span className="text-ink-mute">Meetings <span className="font-semibold text-ink">{fmtNum(teamMeetings)}</span></span>
                  <span className="text-ink-mute">Signed <span className="font-semibold text-ink">{fmtNum(teamSigned)}</span></span>
                  {canAssign && (
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-mute">Reports to</span>
                      <Dropdown
                        size="sm" className="w-32"
                        value={leader.teamLeadId ?? ''}
                        onChange={(v) => actor && updateUser(actor, leader.id, { teamLeadId: v || null })}
                        options={lcvpSelfOptions}
                      />
                    </div>
                  )}
                </div>
              </div>

              {team.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-mute">
                  No members assigned to this team yet{canAssign ? ' — assign members below or from an unassigned card.' : '.'}
                </p>
              ) : (
                <Table>
                  {memberCols}
                  <TBody>{team.map(memberRow)}</TBody>
                </Table>
              )}
            </Card>
          )
        })}
      </div>

      {/* Unassigned members */}
      {unassigned.length > 0 && (
        <Card className="mt-4">
          <SectionTitle
            title="Unassigned members"
            subtitle={canAssign ? 'Give each one a team leader' : 'Not yet assigned to a team'}
            action={<Badge tone="warning"><UserRound size={12} /> {unassigned.length}</Badge>}
          />
          <Table>
            {memberCols}
            <TBody>{unassigned.map(memberRow)}</TBody>
          </Table>
        </Card>
      )}

      {teamLeaders.length === 0 && unassigned.length === 0 && leadership.length === 0 && (
        <EmptyState icon={<Users size={28} />} title="No team members yet" hint="Members will appear here once they join your LC." />
      )}

      <MemberInfoModal member={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
