// Role-based scoping. One place decides who can see/edit what; routes use the
// can* helpers and data views use the scope* filters. When this moves to
// Supabase these same rules become row-level-security policies.

import type { LocalCommittee, Opportunity, User } from '@/data/types'

export function canViewGlobalDashboard(user: User): boolean {
  return user.role === 'admin'
}

export function canManageUsers(user: User): boolean {
  return user.role === 'admin' || user.role === 'lcp'
}

export function visibleLCs(user: User, lcs: LocalCommittee[]): LocalCommittee[] {
  if (user.role === 'admin') return lcs
  return lcs.filter((lc) => lc.id === user.lcId)
}

/** Ids of users whose data `user` may see (self, team, LC, or everyone). */
export function visibleOwnerIds(user: User, allUsers: User[]): Set<string> | null {
  if (user.role === 'admin') return null // null == no restriction
  if (user.role === 'lcp') {
    return new Set(allUsers.filter((u) => u.lcId === user.lcId).map((u) => u.id))
  }
  if (user.role === 'lcvp') {
    return new Set(
      allUsers
        .filter((u) => u.id === user.id || u.teamLeadId === user.id || u.lcId === user.lcId)
        .map((u) => u.id),
    )
  }
  return new Set([user.id]) // member: only self
}

export function scopeOpportunities(
  user: User, opps: Opportunity[], allUsers: User[],
): Opportunity[] {
  const owners = visibleOwnerIds(user, allUsers)
  if (!owners) return opps
  return opps.filter((o) => owners.has(o.ownerId))
}

/** May `user` edit a record owned by `ownerId`? */
export function canEditOwned(user: User, ownerId: string, ownerLcId?: string | null): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'lcp') return ownerLcId === user.lcId
  if (user.role === 'lcvp') {
    if (ownerId === user.id) return true
    const owner = ownerLcId
    return owner === user.lcId
  }
  return ownerId === user.id
}
