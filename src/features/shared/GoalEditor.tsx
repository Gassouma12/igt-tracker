// Goal-setting modal. Shows the people the actor may manage (members for an
// LCVP, LCVPs for an LCP/MCVP — see rbac.canSetGoalFor) with editable targets.
// Targets are set per cadence (weekly / monthly / semester) + period, so a
// weekly, monthly and semester goal for the same metric never collide.

import { useState } from 'react'
import { useDB } from '@/data/store'
import { setGoal } from '@/data/actions'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/Dropdown'
import { currentPeriod, periodLabel, periodOptions } from '@/lib/dates'
import type { GoalCadence, GoalMetric, User } from '@/data/types'

const METRICS: { key: GoalMetric; label: string }[] = [
  { key: 'outreaches', label: 'Outreaches' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'revenue', label: 'Revenue €' },
]
const CADENCES: { key: GoalCadence; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'semester', label: 'Semester' },
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
  const [cadence, setCadence] = useState<GoalCadence>('semester')
  const [period, setPeriod] = useState(() => currentPeriod('semester'))

  function pickCadence(c: GoalCadence) {
    setCadence(c)
    setPeriod(currentPeriod(c))
  }

  const planned = (uid: string, metric: GoalMetric) =>
    goals.find((g) => g.scope === 'member' && g.ownerId === uid && g.metric === metric
      && (g.cadence ?? 'semester') === cadence && g.period === period)?.planned ?? 0

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Set goals" description="Targets save on blur — weekly, monthly and semester are tracked separately." className="max-w-xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-bg-elev p-1">
          {CADENCES.map((c) => (
            <button
              key={c.key}
              onClick={() => pickCadence(c.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${cadence === c.key ? 'bg-brand text-white' : 'text-ink-mute hover:text-ink'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Dropdown
          className="w-44"
          value={period}
          onChange={setPeriod}
          options={periodOptions(cadence).map((p) => ({ value: p, label: periodLabel(cadence, p) }))}
        />
      </div>

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
                      key={`${u.id}-${m.key}-${cadence}-${period}`}
                      type="number" min={0}
                      defaultValue={planned(u.id, m.key)}
                      className="input px-2 py-1.5 text-sm"
                      onBlur={(e) => setGoal(actor, u, m.key, Math.max(0, Number(e.target.value) || 0), cadence, period)}
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
