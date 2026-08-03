// A styled "who is this person" modal — avatar, role, contact details and a
// snapshot of their numbers, with a separate button to open their pipeline.
// Shared by the Team page and global search.
import { useMemo, useState } from 'react'
import { Building2, Mail, Phone, UserRound, Workflow } from 'lucide-react'
import { useDB } from '@/data/store'
import { outreachCount } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Avatar, Badge, Button } from '@/components/ui/primitives'
import { MemberPipelineModal } from './MemberPipelineModal'
import type { Role, User } from '@/data/types'

const ROLE_TONE: Record<Role, 'brand' | 'info' | 'neutral'> = {
  admin: 'brand', lcp: 'brand', lcvp: 'info', team_leader: 'info', member: 'neutral',
}
const ROLE_LABEL: Record<Role, string> = {
  admin: 'MCVP', lcp: 'LC President', lcvp: 'LC VP Sales', team_leader: 'Team Leader', member: 'Sales Member',
}

export function MemberInfoModal({ member, open, onClose }: { member: User | null; open: boolean; onClose: () => void }) {
  const allOpps = useDB((s) => s.opportunities)
  const allActs = useDB((s) => s.activities)
  const allMtgs = useDB((s) => s.meetings)
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const [showPipeline, setShowPipeline] = useState(false)

  const stats = useMemo(() => {
    if (!member) return null
    const opps = allOpps.filter((o) => o.ownerId === member.id)
    const ids = new Set(opps.map((o) => o.id))
    const acts = allActs.filter((a) => ids.has(a.opportunityId))
    const mtgs = allMtgs.filter((m) => ids.has(m.opportunityId))
    const signed = opps.filter((o) => o.status === 'Contract signed').length
    return {
      outreaches: outreachCount(acts, opps), meetings: mtgs.length, opportunities: opps.length,
      signed, conversion: opps.length ? signed / opps.length : 0,
    }
  }, [member, allOpps, allActs, allMtgs])

  if (!member) return null
  const lcName = lcs.find((l) => l.id === member.lcId)?.name ?? '—'
  const lead = member.teamLeadId ? users.find((u) => u.id === member.teamLeadId) : null

  return (
    <>
      <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Member" className="max-w-lg">
        <div className="flex items-center gap-4">
          <Avatar name={member.name} size={56} />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-ink">{member.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
              <span className="text-sm text-ink-mute">{member.position}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Detail icon={<Mail size={14} />} label="Email" value={member.email ? <a href={`mailto:${member.email}`} className="text-brand hover:underline">{member.email}</a> : '—'} />
          <Detail icon={<Phone size={14} />} label="Phone" value={member.phone || '—'} />
          <Detail icon={<Building2 size={14} />} label="Local Committee" value={lcName} />
          <Detail icon={<UserRound size={14} />} label="Reports to" value={lead?.name ?? '—'} />
        </div>

        {stats && (
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              ['Outreaches', fmtNum(stats.outreaches)],
              ['Meetings', fmtNum(stats.meetings)],
              ['Signed', fmtNum(stats.signed)],
              ['Conversion', fmtPct(stats.conversion, 0)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-line bg-bg-elev py-2.5">
                <p className="font-display text-lg font-bold text-ink">{val}</p>
                <p className="text-[11px] text-ink-mute">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={() => setShowPipeline(true)}><Workflow size={16} /> View pipeline</Button>
        </div>
      </Modal>

      <MemberPipelineModal member={member} open={showPipeline} onClose={() => setShowPipeline(false)} />
    </>
  )
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg-elev px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-mute">{icon} {label}</p>
      <p className="mt-0.5 truncate text-sm text-ink-dim">{value}</p>
    </div>
  )
}
