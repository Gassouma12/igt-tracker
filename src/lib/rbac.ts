// Role-based scoping. One place decides who can see/edit what; routes use the
// can* helpers and data views use the scope* filters. When this moves to
// Supabase these same rules become row-level-security policies.

import type { LocalCommittee, Opportunity, User } from '@/data/types'

const RANK: Record<string, number> = { member: 0, lcvp: 1, lcp: 2, admin: 3 }

/**
 * Everyone who should be notified about a user's wins: all higher-ranked people
 * in the same LC (their VPs and LCP), plus every MCVP (admin).
 */
export function supervisorsOf(user: User, allUsers: User[]): string[] {
  const ids = new Set<string>()
  for (const u of allUsers) {
    if (u.id === user.id || !u.active) continue
    if (u.role === 'admin') { ids.add(u.id); continue } // MCVP always
    if (u.lcId && u.lcId === user.lcId && RANK[u.role] > RANK[user.role]) ids.add(u.id)
  }
  return [...ids]
}

/**
 * Goal-setting hierarchy: LCVP sets their members' goals, LCP sets their VPs',
 * MCVP sets LCVPs' goals.
 */
export function canSetGoalFor(actor: User, target: User): boolean {
  if (actor.role === 'admin') return target.role === 'lcvp'
  if (actor.role === 'lcp') return target.role === 'lcvp' && target.lcId === actor.lcId
  if (actor.role === 'lcvp') return target.role === 'member' && target.lcId === actor.lcId
  return false
}

export function manageableUsers(actor: User, allUsers: User[]): User[] {
  return allUsers.filter((u) => canSetGoalFor(actor, u)).sort((a, b) => a.name.localeCompare(b.name))
}

export function canViewGlobalDashboard(user: User): boolean {
  return user.role === 'admin'
}

/** LCPs and LCVPs (and the MCVP) can assign members to a team lead in their LC. */
export function canAssignMembers(user: User): boolean {
  return user.role === 'admin' || user.role === 'lcp' || user.role === 'lcvp'
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

/**
 * May `user` edit a record owned by `ownerId`? Only the owner and the MCVP
 * (admin) edit; LCP/LCVP can view their members' pipelines but not change them
 * (they can still edit their own opportunities).
 */
export function canEditOwned(user: User, ownerId: string): boolean {
  if (user.role === 'admin') return true
  return ownerId === user.id
}

/**
 * Whose numbers roll up into a person's goal: a member counts only themselves;
 * an LCVP's goal aggregates their own + their team members' (teamLeadId); an LCP
 * spans their whole LC; the MCVP spans everyone.
 */
export function goalContributorIds(subject: User, allUsers: User[]): string[] {
  if (subject.role === 'admin') return allUsers.map((u) => u.id)
  if (subject.role === 'lcp') return allUsers.filter((u) => u.lcId === subject.lcId).map((u) => u.id)
  if (subject.role === 'lcvp') {
    return [subject.id, ...allUsers.filter((u) => u.teamLeadId === subject.id).map((u) => u.id)]
  }
  return [subject.id]
}
