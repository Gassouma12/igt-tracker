// Surfaces companies that look like the same partner entered twice — both across
// LCs and within one LC. Shown on the Companies tab and admin Analytics.

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useDB } from '@/data/store'
import { duplicateCompanyGroups } from '@/lib/metrics'
import { Badge, Card, SectionTitle } from '@/components/ui/primitives'
import type { Company, Opportunity } from '@/data/types'

export function DuplicatesPanel({ companies, opportunities, onOpenCompany }: {
  companies: Company[]
  opportunities: Opportunity[]
  onOpenCompany?: (id: string) => void
}) {
  const lcs = useDB((s) => s.localCommittees)
  const users = useDB((s) => s.users)
  const lcName = (id: string) => lcs.find((l) => l.id === id)?.name ?? '—'
  const groups = useMemo(() => duplicateCompanyGroups(companies, opportunities), [companies, opportunities])
  if (!groups.length) return null

  return (
    <Card className="mb-4 border-warning/30">
      <SectionTitle
        title={`Possible duplicate partners · ${groups.length}`}
        subtitle="Same company looks entered more than once — review and merge"
      />
      <div className="space-y-2">
        {groups.slice(0, 40).map((g) => (
          <div key={g.key} className="rounded-xl border border-line bg-bg-elev p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-ink">
                <AlertTriangle size={14} className="text-warning" /> {g.name}
                <span className="text-xs font-normal text-ink-mute">· {g.companies.length} entries</span>
              </p>
              <Badge tone={g.crossLc ? 'danger' : 'warning'}>{g.crossLc ? `across ${g.lcIds.length} LCs` : 'same LC'}</Badge>
            </div>
            <div className="mt-2 space-y-1.5">
              {g.companies.map((c) => {
                const owners = c.ownerIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as { name: string; email: string }[]
                return (
                  <button
                    key={c.id}
                    onClick={() => onOpenCompany?.(c.id)}
                    disabled={!onOpenCompany}
                    title={onOpenCompany ? 'Open this company' : undefined}
                    className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs transition enabled:hover:border-brand/40 disabled:cursor-default"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{c.name}</span>
                      <span className="text-ink-mute">{c.opps} opp{c.opps === 1 ? '' : 's'} · {c.lcIds.map(lcName).join(', ') || 'No LC'}</span>
                    </div>
                    {owners.length > 0 && (
                      <div className="mt-0.5 text-ink-mute">
                        Worked by {owners.map((o) => `${o.name}${o.email ? ` (${o.email})` : ''}`).join(', ')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
