// Reminders are DERIVED (recomputed from the pipeline), so "delete" / "read all"
// can't live in the DB row — instead we remember which reminders the user has
// dismissed, per browser. A reminder is keyed by kind + lead + date, so if the
// underlying date changes (e.g. a new follow-up date) it resurfaces as new.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DismissedState {
  dismissed: Record<string, true>
  dismiss: (key: string) => void
  dismissMany: (keys: string[]) => void
  restoreAll: () => void
}

export const useDismissedReminders = create<DismissedState>()(
  persist(
    (set) => ({
      dismissed: {},
      dismiss: (key) => set((s) => ({ dismissed: { ...s.dismissed, [key]: true } })),
      dismissMany: (keys) =>
        set((s) => {
          const d = { ...s.dismissed }
          for (const k of keys) d[k] = true
          return { dismissed: d }
        }),
      restoreAll: () => set({ dismissed: {} }),
    }),
    { name: 'igt.reminders.dismissed' },
  ),
)

export const reminderKey = (r: { kind: string; opportunityId: string; date: string | null }): string =>
  `${r.kind}:${r.opportunityId}:${r.date ?? ''}`
