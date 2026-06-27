import { useMemo } from 'react'
import { Check, Mail, Phone, ShieldCheck, X } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { setUserStatus } from '@/data/actions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives'

export default function Approvals() {
  const actor = useCurrentUser()
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const lcName = (id: string | null) => lcs.find((l) => l.id === id)?.name ?? '— No LC —'

  const pending = useMemo(() => users.filter((u) => u.status === 'pending'), [users])
  const decided = useMemo(
    () => users.filter((u) => u.status === 'approved' || u.status === 'rejected').slice(-10).reverse(),
    [users],
  )

  return (
    <div>
      <PageHeader title="Account approvals" subtitle={`${pending.length} request${pending.length === 1 ? '' : 's'} awaiting review`} />

      {pending.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={28} />} title="No pending requests" hint="New sign-ups will appear here for you to approve or decline." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((u) => (
            <Card key={u.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Avatar name={u.name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-ink">{u.name}</p>
                  <p className="text-sm text-ink-mute">{u.position} · {lcName(u.lcId)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                    <span className="inline-flex items-center gap-1"><Mail size={11} /> {u.email}</span>
                    {u.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {u.phone}</span>}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="danger" onClick={() => actor && setUserStatus(actor, u.id, 'rejected')}><X size={14} /> Decline</Button>
                <Button size="sm" onClick={() => actor && setUserStatus(actor, u.id, 'approved')}><Check size={14} /> Approve</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <Card className="mt-4">
          <SectionTitle title="Recently decided" subtitle="Latest approval decisions" />
          <ul className="divide-y divide-line">
            {decided.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex items-center gap-2.5">
                  <Avatar name={u.name} size={26} />
                  <span><span className="font-medium text-ink">{u.name}</span> <span className="text-ink-mute">· {lcName(u.lcId)}</span></span>
                </span>
                <Badge tone={u.status === 'approved' ? 'success' : 'danger'}>{u.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
