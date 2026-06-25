// Domain mutations used by the workspace. They wrap the generic repositories
// and additionally write the audit trail (activityLog) and keep derived fields
// (status, lastActivityAt) consistent — the "smart" layer over plain CRUD.

import { db, newId, nowISO, todayISO } from './store'
import { repo } from './repositories'
import type {
  Activity, ActivityOutcome, ActivityPhase, ActivityType, Company, Contact,
  Opportunity, OpportunityStatus, User,
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
  return activity
}

export async function advanceStage(
  actor: User, opp: Opportunity, to: OpportunityStatus,
): Promise<void> {
  if (to === opp.status) return
  await repo.opportunities.update(opp.id, { status: to, updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `moved ${companyName(opp.companyId)}`, opp.status, to)
}

export async function scheduleFollowUp(
  actor: User, opp: Opportunity, nextActionDate: string, nextAction: string,
): Promise<void> {
  await repo.opportunities.update(opp.id, { nextAction, nextActionDate, updatedAt: nowISO() })
  await log(actor, 'opportunity', opp.id, `scheduled "${nextAction}" on ${nextActionDate} for ${companyName(opp.companyId)}`)
}

export async function addMeeting(
  actor: User, opp: Opportunity,
  data: { date: string; outcome?: string; nextAction?: string },
): Promise<void> {
  const existing = db().meetings.filter((m) => m.opportunityId === opp.id).length
  await repo.meetings.create({
    id: newId('mtg'), opportunityId: opp.id, ownerId: actor.id, date: data.date,
    number: existing + 1, outcome: data.outcome ?? 'Held', nextAction: data.nextAction ?? null,
  })
  await repo.opportunities.update(opp.id, {
    lastActivityAt: data.date, updatedAt: nowISO(),
    status: bump(opp.status, 'Meeting scheduled'),
  })
  await log(actor, 'meeting', opp.id, `logged meeting #${existing + 1} for ${companyName(opp.companyId)}`)
}
