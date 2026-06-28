// Pure roll-ups — the replacement for the spreadsheet's cross-sheet formulas.
// Everything takes plain arrays so it is trivially testable and memoizable.

import type {
  Activity, Company, Contract, Goal, GoalMetric, Meeting, Opportunity, OpportunityStatus, User,
} from '@/data/types'

export const FUNNEL: OpportunityStatus[] = [
  'Prospect', 'Contacted', 'Follow-up', 'Meeting scheduled',
  'Negotiation', 'Contract sent', 'Contract signed',
]

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
const rank = (s: OpportunityStatus) => FUNNEL.indexOf(s)

/** Raw touch volume (every logged activity). Used for channel-mix breakdowns. */
export function totalOutreaches(activities: Activity[]): number {
  return sum(activities.map((a) => a.count || 1))
}

/**
 * Outreach count = distinct COMPANIES contacted. Repeated touches on the same
 * company are follow-ups, not new outreaches (one outreach per company).
 */
export function outreachCount(activities: Activity[], opps: Opportunity[]): number {
  const companyOf = new Map(opps.map((o) => [o.id, o.companyId]))
  const seen = new Set<string>()
  for (const a of activities) {
    const c = companyOf.get(a.opportunityId)
    if (c) seen.add(c)
  }
  return seen.size
}

/** Follow-up touches (everything after the first contact on a company). */
export function followupCount(activities: Activity[]): number {
  return activities.filter((a) => a.phase === 'follow-up').length
}

/**
 * Meetings split: `had` = meetings actually recorded through an interaction
 * (each Meeting row), `scheduled` = opps parked at 'Meeting scheduled' that have
 * no recorded meeting yet (booked but not yet held).
 */
export function meetingStats(opps: Opportunity[], meetings: Meeting[]): { had: number; scheduled: number } {
  const withMeeting = new Set(meetings.map((m) => m.opportunityId))
  return {
    had: meetings.length,
    scheduled: opps.filter((o) => o.status === 'Meeting scheduled' && !withMeeting.has(o.id)).length,
  }
}

export interface Kpis {
  opportunities: number
  active: number
  outreaches: number // distinct companies contacted
  followups: number
  meetings: number
  meetingsScheduled: number
  signed: number
  conversion: number // signed / opportunities
  avgDaysToSign: number | null
}

export function kpis(
  opps: Opportunity[], activities: Activity[], meetings: Meeting[], contracts: Contract[],
): Kpis {
  const signed = opps.filter((o) => o.status === 'Contract signed').length
  const active = opps.filter(
    (o) => o.status !== 'Prospect' && o.status !== 'Lost' && o.status !== 'Contract signed',
  ).length
  const days = contracts.map((c) => c.daysUntilSigned).filter((d): d is number => d != null && d > 0)
  const mtg = meetingStats(opps, meetings)
  return {
    opportunities: opps.length,
    active,
    outreaches: outreachCount(activities, opps),
    followups: followupCount(activities),
    meetings: mtg.had,
    meetingsScheduled: mtg.scheduled,
    signed,
    conversion: opps.length ? signed / opps.length : 0,
    avgDaysToSign: days.length ? Math.round(sum(days) / days.length) : null,
  }
}

/** Funnel "reached" counts: how many opportunities got at least to each stage. */
export function funnel(opps: Opportunity[]): { stage: OpportunityStatus; count: number }[] {
  const live = opps.filter((o) => o.status !== 'Lost')
  return FUNNEL.map((stage, i) => ({
    stage,
    count: live.filter((o) => rank(o.status) >= i).length,
  }))
}

/** Conversion between consecutive funnel stages (0..1). */
export function conversions(opps: Opportunity[]): { from: OpportunityStatus; to: OpportunityStatus; rate: number }[] {
  const f = funnel(opps)
  const out: { from: OpportunityStatus; to: OpportunityStatus; rate: number }[] = []
  for (let i = 0; i < f.length - 1; i++) {
    out.push({
      from: f[i].stage, to: f[i + 1].stage,
      rate: f[i].count ? f[i + 1].count / f[i].count : 0,
    })
  }
  return out
}

/** Opportunities grouped by current status (for kanban / distribution). */
export function statusDistribution(opps: Opportunity[]): Record<OpportunityStatus, number> {
  const base = Object.fromEntries(
    [...FUNNEL, 'Lost'].map((s) => [s, 0]),
  ) as Record<OpportunityStatus, number>
  for (const o of opps) base[o.status]++
  return base
}

export interface PerformanceRow {
  id: string
  name: string
  outreaches: number // distinct companies contacted
  followups: number
  opportunities: number
  meetings: number
  signed: number
  conversion: number
  revenue: number // received revenue
}

/** Metrics a member ranking can be sorted by. */
export type RankMetric = 'outreaches' | 'followups' | 'meetings' | 'signed' | 'revenue' | 'conversion'

function performanceBy(
  keyOf: (o: Opportunity) => string,
  nameOf: (id: string) => string,
  opps: Opportunity[], activities: Activity[], meetings: Meeting[],
): PerformanceRow[] {
  const ids = new Set(opps.map(keyOf))
  const oppId2key = new Map(opps.map((o) => [o.id, keyOf(o)]))
  const rows: PerformanceRow[] = []
  for (const id of ids) {
    const myOpps = opps.filter((o) => keyOf(o) === id)
    const myOppIds = new Set(myOpps.map((o) => o.id))
    const myActs = activities.filter((a) => oppId2key.get(a.opportunityId) === id)
    const myMeetings = meetings.filter((m) => myOppIds.has(m.opportunityId))
    const signed = myOpps.filter((o) => o.status === 'Contract signed').length
    rows.push({
      id, name: nameOf(id),
      outreaches: outreachCount(myActs, myOpps),
      followups: followupCount(myActs),
      opportunities: myOpps.length,
      meetings: myMeetings.length,
      signed,
      conversion: myOpps.length ? signed / myOpps.length : 0,
      revenue: revenue(myOpps).received,
    })
  }
  return rows.sort((a, b) => b.outreaches - a.outreaches)
}

export function performanceByMember(
  opps: Opportunity[], activities: Activity[], meetings: Meeting[], users: User[],
): PerformanceRow[] {
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id
  return performanceBy((o) => o.ownerId, name, opps, activities, meetings)
}

export function performanceByLC(
  opps: Opportunity[], activities: Activity[], meetings: Meeting[],
  lcs: { id: string; name: string }[],
): PerformanceRow[] {
  const name = (id: string) => lcs.find((l) => l.id === id)?.name ?? id
  return performanceBy((o) => o.lcId, name, opps, activities, meetings)
}

// ---- revenue -------------------------------------------------------------
export function revenue(opps: Opportunity[]): { receivable: number; received: number } {
  let receivable = 0
  let received = 0
  for (const o of opps) {
    const v = o.value ?? 0
    if (o.revenueReceived) received += v
    else if (o.status === 'Contract signed' || o.status === 'Contract sent') receivable += v
  }
  return { receivable, received }
}

// ---- goals ---------------------------------------------------------------
export function actualFor(
  metric: GoalMetric, activities: Activity[], meetings: Meeting[], opps: Opportunity[],
): number {
  if (metric === 'outreaches') return outreachCount(activities, opps)
  if (metric === 'meetings') return meetings.length
  if (metric === 'revenue') return revenue(opps).received
  return opps.filter((o) => o.status === 'Contract signed').length
}

export interface GoalProgress {
  metric: GoalMetric
  planned: number
  done: number
  pct: number
  gap: number
}

export function goalProgress(
  goals: Goal[], activities: Activity[], meetings: Meeting[], opps: Opportunity[],
): GoalProgress[] {
  return goals.map((g) => {
    const done = actualFor(g.metric, activities, meetings, opps)
    return {
      metric: g.metric, planned: g.planned, done,
      pct: g.planned ? done / g.planned : 0,
      gap: Math.max(g.planned - done, 0),
    }
  })
}

// ---- timeline ------------------------------------------------------------
function monthKey(d: string | null): string | null {
  return d && d.length >= 7 ? d.slice(0, 7) : null
}

export interface TimelinePoint {
  month: string
  outreaches: number
  meetings: number
  contracts: number
  revenue: number
}

export function timeline(
  activities: Activity[], meetings: Meeting[], contracts: Contract[], opps: Opportunity[] = [],
): TimelinePoint[] {
  // Received revenue per opportunity, realised in the month its contract signed.
  const receivedByOpp = new Map(opps.map((o) => [o.id, o.revenueReceived ? (o.value ?? 0) : 0]))
  const map = new Map<string, TimelinePoint>()
  const get = (m: string) =>
    map.get(m) ?? map.set(m, { month: m, outreaches: 0, meetings: 0, contracts: 0, revenue: 0 }).get(m)!
  for (const a of activities) {
    const m = monthKey(a.date)
    if (m) get(m).outreaches += a.count || 1
  }
  for (const mt of meetings) {
    const m = monthKey(mt.date)
    if (m) get(m).meetings++
  }
  for (const c of contracts) {
    const m = monthKey(c.dateSigned || c.dateSent)
    if (m) {
      get(m).contracts++
      get(m).revenue += receivedByOpp.get(c.opportunityId) ?? 0
    }
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/** Milestone conversion rates across the funnel (cumulative, not just adjacent). */
export function keyConversions(opps: Opportunity[]): { label: string; rate: number }[] {
  const reached = Object.fromEntries(funnel(opps).map((f) => [f.stage, f.count])) as Record<OpportunityStatus, number>
  const safe = (a: number, b: number) => (b ? a / b : 0)
  return [
    { label: 'Contacted → Meeting', rate: safe(reached['Meeting scheduled'], reached['Contacted']) },
    { label: 'Meeting → Contract', rate: safe(reached['Contract sent'], reached['Meeting scheduled']) },
    { label: 'Contract → Signed', rate: safe(reached['Contract signed'], reached['Contract sent']) },
    { label: 'Overall (Contacted → Signed)', rate: safe(reached['Contract signed'], reached['Contacted']) },
  ]
}

// ---- reminders (derived, not stored) -------------------------------------
export interface Reminder {
  kind: 'overdue' | 'upcoming-meeting' | 'inactive'
  opportunityId: string
  label: string
  date: string | null
}

const INACTIVE_DAYS = 21

export function reminders(
  opps: Opportunity[], meetings: Meeting[], today = new Date().toISOString().slice(0, 10),
): Reminder[] {
  const out: Reminder[] = []
  const t = new Date(today).getTime()
  const isOpen = (o: Opportunity) => o.status !== 'Contract signed' && o.status !== 'Lost'

  for (const o of opps) {
    if (!isOpen(o)) continue
    if (o.nextActionDate && o.nextActionDate < today) {
      out.push({ kind: 'overdue', opportunityId: o.id, label: o.nextAction ?? 'Follow-up overdue', date: o.nextActionDate })
    }
    if (o.lastActivityAt) {
      const days = (t - new Date(o.lastActivityAt).getTime()) / 86_400_000
      if (days > INACTIVE_DAYS) {
        out.push({ kind: 'inactive', opportunityId: o.id, label: `No activity in ${Math.round(days)} days`, date: o.lastActivityAt })
      }
    }
  }
  for (const m of meetings) {
    if (!m.date) continue
    const days = (new Date(m.date).getTime() - t) / 86_400_000
    if (days >= 0 && days <= 7) {
      out.push({ kind: 'upcoming-meeting', opportunityId: m.opportunityId, label: `Meeting #${m.number} upcoming`, date: m.date })
    }
  }
  return out
}

// ---- duplicate partner detection -----------------------------------------
export interface DuplicateCompany {
  id: string
  name: string
  lcIds: string[]
  ownerIds: string[]
  opps: number
}
export interface DuplicateGroup {
  key: string // normalized name
  name: string // first display variant
  crossLc: boolean // duplicated across different LCs (vs all in one LC)
  lcIds: string[] // every LC touching this partner
  companies: DuplicateCompany[]
}

/** Normalised company name for matching — drops legal suffixes & punctuation. */
function normCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(nv|sa|bv|bvba|sprl|srl|gmbh|ltd|llc|inc|co|comm\.?v|the|group|groep|belgium|belgie|belgië|luxembourg)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Companies that look like the same partner (same normalised name) — flags
 * data-entry duplicates both across LCs and within a single LC.
 */
export function duplicateCompanyGroups(companies: Company[], opportunities: Opportunity[]): DuplicateGroup[] {
  const byKey = new Map<string, Company[]>()
  for (const c of companies) {
    const k = normCompany(c.name)
    if (!k) continue
    byKey.set(k, [...(byKey.get(k) ?? []), c])
  }
  const oppsByCompany = new Map<string, Opportunity[]>()
  for (const o of opportunities) oppsByCompany.set(o.companyId, [...(oppsByCompany.get(o.companyId) ?? []), o])

  const groups: DuplicateGroup[] = []
  for (const [key, comps] of byKey) {
    if (comps.length < 2) continue
    const detail: DuplicateCompany[] = comps.map((c) => {
      const os = oppsByCompany.get(c.id) ?? []
      return {
        id: c.id, name: c.name,
        lcIds: [...new Set(os.map((o) => o.lcId).filter(Boolean))],
        ownerIds: [...new Set(os.map((o) => o.ownerId))],
        opps: os.length,
      }
    })
    const lcIds = [...new Set(detail.flatMap((d) => d.lcIds))]
    groups.push({ key, name: comps[0].name, crossLc: lcIds.length > 1, lcIds, companies: detail })
  }
  return groups.sort((a, b) => b.companies.length - a.companies.length)
}
