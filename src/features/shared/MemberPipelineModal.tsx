// View-only kanban of one member's pipeline. Opened from the Team page (LCP /
// LCVP) and User Management (MCVP) so supervisors can browse a member's board
// without editing. Cards open the lead detail, which is itself view-only for
// non-owners (rbac.canEditOwned).

import { useMemo, useState } from 'react'
import { useDB } from '@/data/store'
import { FUNNEL } from '@/lib/metrics'
import { STATUS_STYLE } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { OpportunityDialog } from '@/features/member/OpportunityDialog'
import { relativeDays } from '@/lib/format'
import type { OpportunityStatus, User } from '@/data/types'

const COLUMNS: OpportunityStatus[] = [...FUNNEL, 'Lost']

export function MemberPipelineModal({ member, open, onClose }: { member: User | null; open: boolean; onClose: () => void }) {
  const allOpps = useDB((s) => s.opportunities)
  const companies = useDB((s) => s.companies)
  const contacts = useDB((s) => s.contacts)
  const [openId, setOpenId] = useState<string | null>(null)

  const opps = useMemo(() => (member ? allOpps.filter((o) => o.ownerId === member.id) : []), [allOpps, member])
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const contactName = (id: string | null) => (id ? contacts.find((c) => c.id === id)?.name : undefined)

  if (!member) return null
  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={`${member.name} · pipeline`}
        description={`${opps.length} opportunities · view only`}
        className="max-w-5xl"
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((status) => {
            const items = opps.filter((o) => o.status === status)
            return (
              <div key={status} className="flex w-60 shrink-0 flex-col rounded-2xl border border-line bg-bg-elev/50">
                <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[status].dot }} />
                    {status}
                  </span>
                  <span className="text-xs text-ink-mute">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 p-2">
                  {items.slice(0, 50).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setOpenId(o.id)}
                      className="rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand/40 hover:shadow-card"
                    >
                      <p className="truncate text-sm font-medium text-ink">{companyName(o.companyId)}</p>
                      {contactName(o.contactId) && <p className="truncate text-xs text-ink-mute">{contactName(o.contactId)}</p>}
                      <p className="mt-1.5 text-[11px] text-ink-mute">{relativeDays(o.lastActivityAt)}</p>
                    </button>
                  ))}
                  {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-ink-mute">Empty</p>}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
