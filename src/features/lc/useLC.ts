// LC-scoped view for LCP / LCVP pages: the signed-in user's Local Committee,
// its members and goals, plus the role-scoped opportunity data (reuses
// useScopedData, which already returns LC-wide data for lcp/lcvp).

import { useMemo } from 'react'
import { useDB } from '@/data/store'
import { useScopedData } from '@/features/member/useScopedData'
import type { Goal, LocalCommittee, User } from '@/data/types'

export function useLC() {
  const scoped = useScopedData()
  const lcId = scoped.user?.lcId ?? null
  const allLcs = useDB((s) => s.localCommittees)
  const allUsers = useDB((s) => s.users)
  const allGoals = useDB((s) => s.goals)

  return useMemo(() => {
    const lc: LocalCommittee | undefined = allLcs.find((l) => l.id === lcId)
    const members: User[] = allUsers.filter((u) => u.lcId === lcId)
    const lcGoals: Goal[] = allGoals.filter((g) => g.scope === 'lc' && g.lcId === lcId)
    const memberGoals: Goal[] = allGoals.filter((g) => g.scope === 'member' && g.lcId === lcId)
    const userById = (id: string) => allUsers.find((u) => u.id === id)
    return { ...scoped, lcId, lc, members, lcGoals, memberGoals, userById }
  }, [scoped, lcId, allLcs, allUsers, allGoals])
}
