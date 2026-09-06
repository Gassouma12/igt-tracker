// Domain mutations used by the workspace. They wrap the generic repositories
// and additionally write the audit trail (activityLog) and keep derived fields
// (status, lastActivityAt) consistent — the "smart" layer over plain CRUD.

import { db, newId, nowISO, todayISO, useDB } from './store'
import { repo, hydrateFromSupabase } from './repositories'
import { canEditOwned, canManageUsers, canSetGoalFor, supervisorsOf } from '@/lib/rbac'
import { supabase, useSupabaseAuth } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import type {
  AccountStatus, Activity, ActivityOutcome, ActivityPhase, ActivityType, Company, Contact,
  GoalCadence, GoalMetric, NotificationKind, Opportunity, OpportunityStatus, Role, User,
} from './types'

// The MCVP account is protected everywhere: nobody may change their role or
// deactivate them. Mirrors the client guard in UserManagement + the RLS intent.
const MCVP_EMAIL = 'kacem@aiesec.be'
const isMCVP = (u: User | undefined | null) => u?.email?.toLowerCase() === MCVP_EMAIL

function companyName(companyId: string): string {
  return db().companies.find((c) => c.id === companyId)?.name ?? 'company'
}

// ---- permission gates (defense in depth; RLS in supabase/rls.sql is the real
// ---- enforcer, these stop a disallowed write before it optimistically lands) --

/** Owner + admin only. Returns false (and toasts) when the actor may not edit. */
function ensureCanEdit(actor: User, ownerId: string): boolean {
  if (canEditOwned(actor, ownerId)) return true
  toast.error("You don't have permission to change this record.")
  return false
}

async function log(
  actor: User, entity: string, entityId: string, action: string,
  from: string | null = null, to: string | null = null,
) {
  await repo.activityLog.create({
    id: newId('log'), actorId: actor.id, entity, entityId, action,
    from, to, at: nowISO(),
  })
}

/** Notify the actor's supervisors (LC chain above them) + MCVP of a win. */
async function notify(actor: User, opp: Opportunity, kind: NotificationKind, verb: string) {
  const company = companyName(opp.companyId)
  for (const recipientId of supervisorsOf(actor, db().users)) {
    await repo.notifications.create({
      id: newId('ntf'), recipientId, actorId: actor.id, opportunityId: opp.id,
      kind, message: `${actor.name} ${verb} ${company}`, read: false, at: nowISO(),
    })
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await repo.notifications.update(id, { read: true })
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  for (const n of db().notifications) {
    if (n.recipientId === recipientId && !n.read) await repo.notifications.update(n.id, { read: true })
  }
}

/** Permanently delete a notification (recipient-owned; RLS: recipient or admin). */
export async function deleteNotification(actor: User, id: string): Promise<void> {
  const n = db().notifications.find((x) => x.id === id)
  if (!n || (n.recipientId !== actor.id && actor.role !== 'admin')) return
  await repo.notifications.remove(id)
}

/** Clear every one of the recipient's notifications at once. */
export async function clearAllNotifications(recipientId: string): Promise<void> {
  for (const n of db().notifications.filter((x) => x.recipientId === recipientId)) {
    await repo.notifications.remove(n.id)
  }
}

/** Status the opportunity should reach after a given activity (never downgrades). */
const RANK: OpportunityStatus[] = [
  'Prospect', 'Contacted', 'Follow-up', 'Meeting scheduled',
  'Negotiation', 'Contract sent', 'Contract signed',
]
function bump(current: OpportunityStatus, target: OpportunityStatus): OpportunityStatus {
  if (current === 'Lost') return current
  return RANK.indexOf(target) > RANK.indexOf(current) ? target : current
}

export async function createCompany(
  actor: User, data: Pick<Company, 'name'> & Partial<Company>,
): Promise<Company> {
  const company: Company = {
    id: newId('co'), name: data.name.trim(), industry: data.industry ?? null,
    country: data.country ?? 'Belgium', website: data.website ?? null,
    linkedin: data.linkedin ?? null, notes: data.notes ?? null,
    // ponytail: only attach taxNumber when set — keeps company creation working
    // even before the "taxNumber" column exists in the DB (migration is separate).
    ...(data.taxNumber ? { taxNumber: data.taxNumber.trim() } : {}),
  }
  await repo.companies.create(company)
  return company
}

export async function setCompanyTaxNumber(actor: User, company: Company, taxNumber: string): Promise<void> {
  await repo.companies.update(company.id, { taxNumber: taxNumber.trim() || null })
}

export async function createContact(
  actor: User, data: Pick<Contact, 'companyId' | 'name'> & Partial<Contact>,
): Promise<Contact> {
  const contact: Contact = {
    id: newId('ct'), companyId: data.companyId, name: data.name.trim(),
    role: data.role ?? null, email: data.email ?? null,
    phone: data.phone ?? null, linkedin: data.linkedin ?? null,
  }
  await repo.contacts.create(contact)
  return contact
}

/** Edit an existing contact's details (approved users; mirrors contacts_update RLS). */
export async function updateContact(
  actor: User, contact: Contact,
  patch: Partial<Pick<Contact, 'name' | 'role' | 'email' | 'phone' | 'linkedin'>>,
): Promise<void> {
  const clean: Partial<Contact> = {}
  if (patch.name !== undefined) clean.name = patch.name?.trim() || contact.name
  if (patch.role !== undefined) clean.role = patch.role?.trim() || null
  if (patch.email !== undefined) clean.email = patch.email?.trim() || null
  if (patch.phone !== undefined) clean.phone = patch.phone?.trim() || null
  if (patch.linkedin !== undefined) clean.linkedin = patch.linkedin?.trim() || null
  await repo.contacts.update(contact.id, clean)
}

/** Change which contact a lead is primarily tied to (owner + admin only). */
export async function setOpportunityContact(
  actor: User, opp: Opportunity, contactId: string | null,
): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  await repo.opportunities.update(opp.id, { contactId, updatedAt: nowISO() })
}

export async function createOpportunity(
  actor: User, data: { companyId: string; contactId?: string | null; lcId: string },
): Promise<Opportunity> {
  const opp: Opportunity = {
    id: newId('opp'), companyId: data.companyId, contactId: data.contactId ?? null,
    ownerId: actor.id, lcId: data.lcId, status: 'Prospect',
    value: 0, revenueReceived: false,
    nextAction: null, nextActionDate: null,
    lastActivityAt: todayISO(), createdAt: todayISO(), updatedAt: todayISO(),
  }
  await repo.opportunities.create(opp)
  await log(actor, 'opportunity', opp.id, `created opportunity for ${companyName(opp.companyId)}`)
  return opp
}

export async function logActivity(
  actor: User, opp: Opportunity,
  data: { type: ActivityType; phase: ActivityPhase; outcome?: ActivityOutcome; notes?: string; date?: string },
): Promise<Activity | undefined> {
  if (!ensureCanEdit(actor, opp.ownerId)) return undefined
  const activity: Activity = {
    id: newId('act'), opportunityId: opp.id, ownerId: actor.id, type: data.type,
    phase: data.phase, count: 1, outcome: data.outcome ?? 'neutral',
    date: data.date ?? todayISO(), notes: data.notes ?? null,
  }
  await repo.activities.create(activity)

  const target: OpportunityStatus =
    data.type === 'Meeting' ? 'Meeting scheduled'
      : data.phase === 'follow-up' ? 'Follow-up'
        : 'Contacted'
  const nextStatus = bump(opp.status, target)
  await repo.opportunities.update(opp.id, {
    lastActivityAt: activity.date, updatedAt: nowISO(), status: nextStatus,
  })
  // Only the stage move is worth an audit entry — the raw touch is not (volume).
  if (nextStatus !== opp.status) {
    await log(actor, 'opportunity', opp.id, `moved ${companyName(opp.companyId)}`, opp.status, nextStatus)
  }
  if (data.type === 'Meeting') await notify(actor, opp, 'meeting', 'logged a meeting with')
  return activity
}

export async function advanceStage(
  actor: User, opp: Opportunity, to: OpportunityStatus,
): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  if (to === opp.status) return
  await repo.opportunities.update(opp.id, { status: to, updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `moved ${companyName(opp.companyId)}`, opp.status, to)
  // Reaching these stages is a "win" worth notifying supervisors about — fired
  // here so the kanban drag and the dialog's stage dropdown behave the same as
  // logging a meeting / signing through the detail panel.
  if (to === 'Meeting scheduled') await notify(actor, opp, 'meeting', 'scheduled a meeting with')
  if (to === 'Contract signed') await notify(actor, opp, 'contract', 'signed a contract with')
  // Keep the contract record in step with the stage, so dateSent/dateSigned/
  // daysUntilSigned are live data — not just migrated history.
  if (to === 'Contract sent' || to === 'Contract signed') await touchContract(opp, to)
}

async function touchContract(opp: Opportunity, stage: 'Contract sent' | 'Contract signed'): Promise<void> {
  const existing = db().contracts.find((k) => k.opportunityId === opp.id)
  const today = todayISO()
  if (!existing) {
    await repo.contracts.create({
      id: newId('con'), opportunityId: opp.id,
      dateSent: stage === 'Contract sent' ? today : null,
      dateSigned: stage === 'Contract signed' ? today : null,
      daysUntilSigned: null,
    })
    return
  }
  if (stage === 'Contract sent' && !existing.dateSent) {
    await repo.contracts.update(existing.id, { dateSent: today })
  } else if (stage === 'Contract signed' && !existing.dateSigned) {
    const days = existing.dateSent
      ? Math.max(0, Math.round((new Date(today).getTime() - new Date(existing.dateSent).getTime()) / 86_400_000))
      : null
    await repo.contracts.update(existing.id, { dateSigned: today, daysUntilSigned: days })
  }
}

/** When is this deal's money expected? Feeds the receivables schedule. */
export async function setExpectedPayment(actor: User, opp: Opportunity, date: string | null): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  await repo.opportunities.update(opp.id, { expectedPaymentDate: date, updatedAt: nowISO() })
}

/** Delete a lead and its local children (the DB cascades from the one delete). */
export async function deleteOpportunity(actor: User, opp: Opportunity): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  const d = db()
  useDB.getState().patch({
    activities: d.activities.filter((a) => a.opportunityId !== opp.id),
    meetings: d.meetings.filter((m) => m.opportunityId !== opp.id),
    contracts: d.contracts.filter((k) => k.opportunityId !== opp.id),
    notifications: d.notifications.filter((n) => n.opportunityId !== opp.id),
  })
  await repo.opportunities.remove(opp.id)
  await log(actor, 'opportunity', opp.id, `deleted opportunity for ${companyName(opp.companyId)}`)
}

export async function deleteContact(actor: User, contact: Contact): Promise<void> {
  const d = db()
  // The DB FK sets opportunities.contactId null on delete; mirror that locally.
  useDB.getState().patch({
    opportunities: d.opportunities.map((o) => (o.contactId === contact.id ? { ...o, contactId: null } : o)),
  })
  await repo.contacts.remove(contact.id)
}

export async function setDealValue(actor: User, opp: Opportunity, value: number): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  await repo.opportunities.update(opp.id, { value: Math.max(0, value), updatedAt: nowISO() })
}

export async function setRevenueReceived(actor: User, opp: Opportunity, received: boolean): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  await repo.opportunities.update(opp.id, { revenueReceived: received, updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `marked ${companyName(opp.companyId)} revenue ${received ? 'received' : 'outstanding'}`)
  // Tell supervisors money landed — include the amount and the partner.
  if (received) {
    const company = companyName(opp.companyId)
    const amount = `€${(opp.value ?? 0).toLocaleString('en-US')}`
    for (const recipientId of supervisorsOf(actor, db().users)) {
      await repo.notifications.create({
        id: newId('ntf'), recipientId, actorId: actor.id, opportunityId: opp.id,
        kind: 'revenue', message: `${actor.name} received ${amount} from ${company}`,
        read: false, at: nowISO(),
      })
    }
  }
}

export async function scheduleFollowUp(
  actor: User, opp: Opportunity, nextActionDate: string, nextAction: string,
): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  await repo.opportunities.update(opp.id, { nextAction, nextActionDate, updatedAt: nowISO() })
}

export async function setGoal(
  actor: User, target: User, metric: GoalMetric, planned: number,
  cadence: GoalCadence = 'semester', period = '2026-S1',
): Promise<void> {
  if (!canSetGoalFor(actor, target)) { toast.error("You can't set goals for this person."); return }
  // The (owner, metric, cadence, period) tuple is unique, so a weekly, monthly
  // and semester target for the same metric never collide.
  const existing = db().goals.find(
    (g) => g.scope === 'member' && g.ownerId === target.id && g.metric === metric
      && (g.cadence ?? 'semester') === cadence && g.period === period,
  )
  if (existing) {
    if (existing.planned === planned) return
    await repo.goals.update(existing.id, { planned })
  } else {
    await repo.goals.create({
      id: newId('goal'), scope: 'member', ownerId: target.id, lcId: target.lcId,
      period, cadence, metric, planned,
    })
  }
  await log(actor, 'goal', target.id, `set ${target.name}'s ${cadence} ${metric} target to ${planned}`)
  // Let the person know a goal was set for them.
  await repo.notifications.create({
    id: newId('ntf'), recipientId: target.id, actorId: actor.id, opportunityId: null,
    kind: 'goal', message: `${actor.name} set your ${cadence} ${metric} target to ${planned}`,
    read: false, at: nowISO(),
  })
}

export async function setCompanyNotes(actor: User, company: Company, notes: string): Promise<void> {
  await repo.companies.update(company.id, { notes: notes.trim() || null })
}

export async function updateUser(
  actor: User, userId: string, patch: Partial<User>,
): Promise<void> {
  const before = db().users.find((u) => u.id === userId)
  // The MCVP is protected: their role and active flag can never be changed.
  if (isMCVP(before) && ('role' in patch || 'active' in patch)) {
    toast.error('The MCVP account is protected and cannot be changed.')
    return
  }
  // Only an admin, or an LC lead (lcp/lcvp) acting on a member/team-leader in
  // their own LC, may edit a user. Mirrors users_* policies in rls.sql.
  const canManage = canManageUsers(actor)
    || (actor.role === 'lcvp' && !!before && before.lcId === actor.lcId
        && (before.role === 'member' || before.role === 'team_leader'))
  if (!canManage) { toast.error("You don't have permission to edit this user."); return }
  await repo.users.update(userId, patch)
  const field = Object.keys(patch)[0]
  await log(actor, 'user', userId, `updated ${before?.name ?? 'user'} (${field})`,
    String((before as Record<string, unknown> | undefined)?.[field] ?? ''),
    String((patch as Record<string, unknown>)[field] ?? ''))
}

/** Add/refresh a user row in the local store without a second DB write (used when
 *  the profile was created server-side, e.g. by the request_account RPC). */
function upsertUserLocal(user: User): void {
  const users = db().users
  const next = users.some((u) => u.id === user.id)
    ? users.map((u) => (u.id === user.id ? { ...u, ...user } : u))
    : [...users, user]
  useDB.getState().patch({ users: next })
}

/** True when a Supabase error means the email is already registered in Auth. */
function isAlreadyRegistered(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false
  const m = (error.message ?? '').toLowerCase()
  return m.includes('already registered') || m.includes('already exists') || m.includes('user already')
}

/**
 * Self-service account creation. New accounts start 'pending' admin approval.
 * In real-auth mode this also creates the Supabase Auth user; the profile row is
 * keyed on the auth uid.
 *
 * Re-registration after deletion: if the email still exists in Auth we sign the
 * person in with the password they supplied, then (re)create their pending
 * profile via the request_account RPC — which reclaims any stale row with the
 * same email and fires the admin-approval trigger. The RPC degrades to a plain
 * insert when it isn't deployed yet, so signup keeps working either way.
 */
export async function signUp(data: {
  name: string; email: string; phone?: string; position?: string; lcId: string | null
  role?: Role; password?: string
}): Promise<User> {
  const email = data.email.trim().toLowerCase()
  let id = newId('usr')
  if (useSupabaseAuth && supabase) {
    const { data: auth, error } = await supabase.auth.signUp({ email, password: data.password ?? '' })
    if (error) {
      if (!isAlreadyRegistered(error)) throw error
      // Email exists in Auth (e.g. a previously-deleted profile). Sign them in so
      // we can rebuild their pending profile under their own uid.
      const { data: signIn, error: signInErr } =
        await supabase.auth.signInWithPassword({ email, password: data.password ?? '' })
      if (signInErr || !signIn.user) {
        throw new Error(
          'An account with this email already exists. If it is yours, sign in instead — or email kacem@aiesec.be to reset your password.',
        )
      }
      id = signIn.user.id
    } else if (auth.user) {
      id = auth.user.id
    }
  }
  const user: User = {
    id, name: data.name.trim(), email,
    role: data.role ?? 'member', lcId: data.lcId, position: data.position?.trim() || 'Member',
    teamLeadId: null, active: true, phone: data.phone?.trim() || null, status: 'pending',
  }

  if (useSupabaseAuth && supabase) {
    // Server-side reclaim + insert (SECURITY DEFINER) so re-signup after deletion
    // notifies admins reliably. Falls back to a direct insert if not yet deployed.
    const { error } = await supabase.rpc('request_account', {
      p_name: user.name, p_email: user.email, p_phone: user.phone,
      p_position: user.position, p_lc: user.lcId, p_role: user.role,
    })
    if (error) {
      console.warn('[signup] request_account RPC unavailable — falling back to direct insert', error)
      await repo.users.create(user)
    } else {
      upsertUserLocal(user) // reflect the server-side row locally for the pending screen
    }
  } else {
    await repo.users.create(user)
    // Pure-mock demo has no trigger — notify admins client-side.
    for (const admin of db().users.filter((u) => u.role === 'admin' && u.active)) {
      await repo.notifications.create({
        id: newId('ntf'), recipientId: admin.id, actorId: user.id, opportunityId: null,
        kind: 'goal', message: `${user.name} requested an account — approval needed`,
        read: false, at: nowISO(),
      })
    }
  }
  return user
}

/** Real-auth sign-in (no-op in mock mode — callers use useSession.login there). */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!useSupabaseAuth || !supabase) return
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw error
  // Pull the profile + data now (with the JWT attached) so the app doesn't route
  // on an empty store the instant after sign-in.
  await hydrateFromSupabase()
}

export async function setUserStatus(actor: User, userId: string, status: AccountStatus): Promise<void> {
  if (actor.role !== 'admin') { toast.error('Only an MCVP can approve or decline accounts.'); return }
  const before = db().users.find((u) => u.id === userId)
  await repo.users.update(userId, { status })
  await log(actor, 'user', userId, `${status} account for ${before?.name ?? 'user'}`)
  // Tell the person the gate lifted (their pending screen also flips live via realtime).
  if (status === 'approved') {
    await repo.notifications.create({
      id: newId('ntf'), recipientId: userId, actorId: actor.id, opportunityId: null,
      kind: 'goal', message: 'Your account was approved — welcome to iGT! 🎉',
      read: false, at: nowISO(),
    })
  }
}

export async function addMeeting(
  actor: User, opp: Opportunity,
  data: { date: string; outcome?: string; nextAction?: string; notes?: string },
): Promise<void> {
  if (!ensureCanEdit(actor, opp.ownerId)) return
  const existing = db().meetings.filter((m) => m.opportunityId === opp.id).length
  await repo.meetings.create({
    id: newId('mtg'), opportunityId: opp.id, ownerId: actor.id, date: data.date,
    number: existing + 1, outcome: data.outcome ?? 'Held', nextAction: data.nextAction ?? null,
    notes: data.notes?.trim() || null,
  })
  await repo.opportunities.update(opp.id, {
    lastActivityAt: data.date, updatedAt: nowISO(),
    status: bump(opp.status, 'Meeting scheduled'),
  })
  await log(actor, 'meeting', opp.id, `logged meeting #${existing + 1} for ${companyName(opp.companyId)}`)
  await notify(actor, opp, 'meeting', 'scheduled a meeting with')
}
