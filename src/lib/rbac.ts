// Role-based scoping. One place decides who can see/edit what; routes use the
// can* helpers and data views use the scope* filters. These rules mirror the
// Supabase row-level-security policies (supabase/rls.sql).
//
// Hierarchy (high → low): admin (MCVP) › lcp › lcvp › team_leader › member.
//   member.teamLeadId  → their team_leader
//   team_leader.teamLeadId → their lcvp
//   lcvp / lcp belong to an LC via lcId; admin is org-wide (no LC).

import type { LocalCommittee, Opportunity, User } from '@/data/types'

const RANK: Record<string, number> = { member: 0, team_leader: 1, lcvp: 2, lcp: 3, admin: 4 }

/**
 * Everyone who should be notified about a user's wins: all higher-ranked people
 * in the same LC (their team leader, VPs and LCP), plus every MCVP (admin).
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
 * Goal-setting hierarchy:
 *   MCVP (admin) → LCVPs · LCVP → team leaders (same LC) ·
 *   team leader → their own members. LCPs are view-only (set no goals).
 */
export function canSetGoalFor(actor: User, target: User): boolean {
  if (actor.role === 'admin') return target.role === 'lcvp'
  if (actor.role === 'lcvp') return target.role === 'team_leader' && target.lcId === actor.lcId
  if (actor.role === 'team_leader') return target.role === 'member' && target.teamLeadId === actor.id
  return false // lcp (view-only) and member
}

export function manageableUsers(actor: User, allUsers: User[]): User[] {
  return allUsers.filter((u) => canSetGoalFor(actor, u)).sort((a, b) => a.name.localeCompare(b.name))
}

export function canViewGlobalDashboard(user: User): boolean {
  return user.role === 'admin'
}

/** Only the LCVP organises their LC — assigning each member to a team leader. */
export function canAssignMembers(user: User): boolean {
  return user.role === 'lcvp'
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
  if (user.role === 'lcp' || user.role === 'lcvp') {
    // Whole LC — LCVP "sees everything sales in their LC", LCP oversees it.
    return new Set(allUsers.filter((u) => u.lcId === user.lcId).map((u) => u.id))
  }
  if (user.role === 'team_leader') {
    // Themselves + the members they lead.
    return new Set(
      allUsers.filter((u) => u.id === user.id || u.teamLeadId === user.id).map((u) => u.id),
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
 * (admin) edit; everyone else (LCP/LCVP/team leader) can view the pipelines
 * they oversee but not change them (they can still edit their own).
 */
export function canEditOwned(user: User, ownerId: string): boolean {
  if (user.role === 'admin') return true
  return ownerId === user.id
}

/**
 * Whose numbers roll up into a person's goal/performance: a member counts only
 * themselves; a team leader aggregates self + their members; an LCVP or LCP
 * spans their whole LC; the MCVP spans everyone.
 */
export function goalContributorIds(subject: User, allUsers: User[]): string[] {
  if (subject.role === 'admin') return allUsers.map((u) => u.id)
  if (subject.role === 'lcp' || subject.role === 'lcvp') {
    return allUsers.filter((u) => u.lcId === subject.lcId).map((u) => u.id)
  }
  if (subject.role === 'team_leader') {
    return [subject.id, ...allUsers.filter((u) => u.teamLeadId === subject.id).map((u) => u.id)]
  }
  return [subject.id]
}
