// Goal-setting modal. Shows the people the actor may manage (members for an
// LCVP, LCVPs for an LCP/MCVP — see rbac.canSetGoalFor) with editable targets.

import { useDB } from '@/data/store'
import { setGoal } from '@/data/actions'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/primitives'
import type { GoalMetric, User } from '@/data/types'

const METRICS: { key: GoalMetric; label: string }[] = [
  { key: 'outreaches', label: 'Outreaches' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'revenue', label: 'Revenue €' },
]

export function GoalEditorModal({
  open, onClose, actor, users,
}: {
  open: boolean
  onClose: () => void
  actor: User
  users: User[]
}) {
  const goals = useDB((s) => s.goals)
  const planned = (uid: string, metric: GoalMetric) =>
    goals.find((g) => g.scope === 'member' && g.ownerId === uid && g.metric === metric)?.planned ?? 0

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Set goals" description="2026 S1 targets — changes save on blur" className="max-w-xl">
      {users.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-mute">No one to set goals for.</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-line bg-bg-elev p-3">
              <div className="mb-2 flex items-center gap-2">
                <Avatar name={u.name} size={26} />
                <span className="text-sm font-medium text-ink">{u.name}</span>
                <span className="text-[10px] uppercase text-ink-mute">{u.role}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {METRICS.map((m) => (
                  <label key={m.key} className="block">
                    <span className="mb-1 block text-[11px] text-ink-mute">{m.label}</span>
                    <input
                      type="number" min={0}
                      defaultValue={planned(u.id, m.key)}
                      className="input px-2 py-1.5 text-sm"
                      onBlur={(e) => setGoal(actor, u, m.key, Math.max(0, Number(e.target.value) || 0))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
