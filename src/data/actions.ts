// Domain mutations used by the workspace. They wrap the generic repositories
// and additionally write the audit trail (activityLog) and keep derived fields
// (status, lastActivityAt) consistent — the "smart" layer over plain CRUD.

import { db, newId, nowISO, todayISO } from './store'
import { repo } from './repositories'
import { supervisorsOf } from '@/lib/rbac'
import { supabase, useSupabaseAuth } from '@/lib/supabase'
import type {
  AccountStatus, Activity, ActivityOutcome, ActivityPhase, ActivityType, Company, Contact,
  GoalCadence, GoalMetric, NotificationKind, Opportunity, OpportunityStatus, Role, User,
} from './types'

function companyName(companyId: string): string {
  return db().companies.find((c) => c.id === companyId)?.name ?? 'company'
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
  }
  await repo.companies.create(company)
  await log(actor, 'company', company.id, `added company ${company.name}`)
  return company
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
  await log(actor, 'contact', contact.id, `added contact ${contact.name}`)
  return contact
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
): Promise<Activity> {
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
  await log(actor, 'opportunity', opp.id, `logged ${data.type} (${data.phase}) for ${companyName(opp.companyId)}`)
  if (nextStatus !== opp.status) {
    await log(actor, 'opportunity', opp.id, `moved ${companyName(opp.companyId)}`, opp.status, nextStatus)
  }
  if (data.type === 'Meeting') await notify(actor, opp, 'meeting', 'logged a meeting with')
  return activity
}

export async function advanceStage(
  actor: User, opp: Opportunity, to: OpportunityStatus,
): Promise<void> {
  if (to === opp.status) return
  await repo.opportunities.update(opp.id, { status: to, updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `moved ${companyName(opp.companyId)}`, opp.status, to)
  // Reaching these stages is a "win" worth notifying supervisors about — fired
  // here so the kanban drag and the dialog's stage dropdown behave the same as
  // logging a meeting / signing through the detail panel.
  if (to === 'Meeting scheduled') await notify(actor, opp, 'meeting', 'scheduled a meeting with')
  if (to === 'Contract signed') await notify(actor, opp, 'contract', 'signed a contract with')
}

export async function setDealValue(actor: User, opp: Opportunity, value: number): Promise<void> {
  await repo.opportunities.update(opp.id, { value: Math.max(0, value), updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `set ${companyName(opp.companyId)} deal value to €${Math.max(0, value)}`)
}

export async function setRevenueReceived(actor: User, opp: Opportunity, received: boolean): Promise<void> {
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
  await repo.opportunities.update(opp.id, { nextAction, nextActionDate, updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `scheduled "${nextAction}" on ${nextActionDate} for ${companyName(opp.companyId)}`)
}

export async function setGoal(
  actor: User, target: User, metric: GoalMetric, planned: number,
  cadence: GoalCadence = 'semester', period = '2026-S1',
): Promise<void> {
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
  await log(actor, 'company', company.id, `updated notes for ${company.name}`)
}

export async function updateUser(
  actor: User, userId: string, patch: Partial<User>,
): Promise<void> {
  const before = db().users.find((u) => u.id === userId)
  await repo.users.update(userId, patch)
  const field = Object.keys(patch)[0]
  await log(actor, 'user', userId, `updated ${before?.name ?? 'user'} (${field})`,
    String((before as Record<string, unknown> | undefined)?.[field] ?? ''),
    String((patch as Record<string, unknown>)[field] ?? ''))
}

/** Self-service account creation. New accounts start 'pending' admin approval.
 *  In real-auth mode this also creates the Supabase Auth user; the profile row
 *  is keyed on the auth uid. */
export async function signUp(data: {
  name: string; email: string; phone?: string; position?: string; lcId: string | null
  role?: Role; password?: string
}): Promise<User> {
  const email = data.email.trim().toLowerCase()
  let id = newId('usr')
  if (useSupabaseAuth && supabase) {
    const { data: auth, error } = await supabase.auth.signUp({ email, password: data.password ?? '' })
    if (error) throw error
    if (auth.user) id = auth.user.id
  }
  const user: User = {
    id, name: data.name.trim(), email,
    role: data.role ?? 'member', lcId: data.lcId, position: data.position?.trim() || 'Member',
    teamLeadId: null, active: true, phone: data.phone?.trim() || null, status: 'pending',
  }
  await repo.users.create(user)
  // Notify every admin (MCVP) that an account is awaiting approval.
  for (const admin of db().users.filter((u) => u.role === 'admin' && u.active)) {
    await repo.notifications.create({
      id: newId('ntf'), recipientId: admin.id, actorId: user.id, opportunityId: null,
      kind: 'goal', message: `${user.name} requested an account — approval needed`,
      read: false, at: nowISO(),
    })
  }
  return user
}

/** Real-auth sign-in (no-op in mock mode — callers use useSession.login there). */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!useSupabaseAuth || !supabase) return
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw error
}

export async function setUserStatus(actor: User, userId: string, status: AccountStatus): Promise<void> {
  const before = db().users.find((u) => u.id === userId)
  await repo.users.update(userId, { status })
  await log(actor, 'user', userId, `${status} account for ${before?.name ?? 'user'}`)
}

export async function addMeeting(
  actor: User, opp: Opportunity,
  data: { date: string; outcome?: string; nextAction?: string; notes?: string },
): Promise<void> {
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
