import { useMemo } from 'react'
import { Crown, MapPin, Star, Users } from 'lucide-react'
import { useDB } from '@/data/store'
import { performanceByLC } from '@/lib/metrics'
import { fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Badge, Card } from '@/components/ui/primitives'

export default function LCManagement() {
  const lcs = useDB((s) => s.localCommittees)
  const users = useDB((s) => s.users)
  const opportunities = useDB((s) => s.opportunities)
  const activities = useDB((s) => s.activities)
  const meetings = useDB((s) => s.meetings)

  const perf = useMemo(
    () => performanceByLC(opportunities, activities, meetings, lcs),
    [opportunities, activities, meetings, lcs],
  )
  const statOf = (id: string) => perf.find((p) => p.id === id)
  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="LC Management" subtitle={`${lcs.length} Local Committees · ${users.filter((u) => u.role !== 'admin').length} members`} />

      <div className="grid gap-4 lg:grid-cols-3">
        {lcs.map((lc) => {
          const s = statOf(lc.id)
          const members = users.filter((u) => u.lcId === lc.id)
          return (
            <Card key={lc.id} className="flex flex-col">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">{lc.name}</h2>
                <Badge tone="neutral"><MapPin size={12} /> {lc.country}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['Outreaches', s?.outreaches ?? 0], ['Meetings', s?.meetings ?? 0], ['Signed', s?.signed ?? 0]].map(([label, val]) => (
                  <div key={label} className="rounded-xl border border-line bg-bg-elev py-2">
                    <p className="font-display text-xl font-bold text-ink">{fmtNum(val as number)}</p>
                    <p className="text-[11px] text-ink-mute">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-mute">
                {fmtNum(s?.opportunities ?? 0)} opportunities · {fmtPct(s?.conversion ?? 0, 1)} conversion
              </p>

              <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                <p className="flex items-center gap-2 text-ink-dim"><Crown size={14} className="text-warning" /> {userName(lc.lcpId)} <span className="text-ink-mute">· LCP</span></p>
                {lc.lcvpIds.map((id) => (
                  <p key={id} className="flex items-center gap-2 text-ink-dim"><Star size={14} className="text-info" /> {userName(id)} <span className="text-ink-mute">· LCVP</span></p>
                ))}
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-mute"><Users size={12} /> {members.length} members</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <span key={m.id} className="flex items-center gap-1.5 rounded-full border border-line bg-bg-elev py-1 pl-1 pr-2.5 text-xs text-ink-dim">
                      <Avatar name={m.name} size={20} /> {m.name}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
