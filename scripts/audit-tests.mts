// One-shot edge-case audit of the pure layers (metrics, dates, rbac, csv).
// Run: npx tsx scripts/audit-tests.mts   — exits non-zero on any failure.
import assert from 'node:assert/strict'
import {
  outreachCount, followupCount, meetingStats, kpis, funnel, conversions,
  keyConversions, statusDistribution, revenue, pipelineValue, receivablesByMonth,
  timeline, goalProgress, duplicateCompanyGroups, performanceByMember, reminders,
} from '../src/lib/metrics'
import { isoWeek, currentPeriod, periodRange, periodLabel, inMonthRange, inDayRange, availableMonths } from '../src/lib/dates'
import { supervisorsOf, canSetGoalFor, goalContributorIds, visibleOwnerIds, canEditOwned, scopeOpportunities } from '../src/lib/rbac'
import { toCSV } from '../src/lib/csv'
import type { Activity, Company, Contract, Goal, Meeting, Opportunity, User } from '../src/data/types'

let n = 0
const t = (name: string, fn: () => void) => {
  try { fn(); n++ } catch (e) { console.error(`✗ ${name}:`, (e as Error).message); process.exitCode = 1 }
}

// ---- factories -------------------------------------------------------------
const opp = (p: Partial<Opportunity>): Opportunity => ({
  id: 'o1', companyId: 'c1', contactId: null, ownerId: 'u1', lcId: 'lc1', status: 'Prospect',
  value: 0, revenueReceived: false, nextAction: null, nextActionDate: null,
  lastActivityAt: null, createdAt: null, updatedAt: null, ...p,
})
const act = (p: Partial<Activity>): Activity => ({
  id: 'a1', opportunityId: 'o1', ownerId: 'u1', type: 'Email', phase: 'first',
  count: 1, outcome: 'neutral', date: '2026-06-01', notes: null, ...p,
})
const mtg = (p: Partial<Meeting>): Meeting => ({
  id: 'm1', opportunityId: 'o1', ownerId: 'u1', date: '2026-06-01', number: 1, outcome: null, nextAction: null, ...p,
})
const usr = (p: Partial<User>): User => ({
  id: 'u1', name: 'U', email: 'u@x', role: 'member', lcId: 'lc1', position: 'M', teamLeadId: null, active: true, ...p,
})
const co = (p: Partial<Company>): Company => ({
  id: 'c1', name: 'X', industry: null, country: null, website: null, linkedin: null, notes: null, ...p,
})

// ---- metrics: empty inputs never divide by zero / NaN ----------------------
t('kpis on empty data', () => {
  const k = kpis([], [], [], [])
  assert.equal(k.conversion, 0); assert.equal(k.outreaches, 0); assert.equal(k.avgDaysToSign, null)
})
t('conversions no NaN on empty', () => {
  for (const c of conversions([])) assert.ok(Number.isFinite(c.rate))
})
t('keyConversions no NaN on empty', () => {
  for (const c of keyConversions([])) assert.ok(Number.isFinite(c.rate))
})
t('goalProgress planned=0 → pct 0, not Infinity', () => {
  const g: Goal = { id: 'g', scope: 'member', ownerId: 'u1', lcId: 'lc1', period: '2026-S1', metric: 'meetings', planned: 0 }
  const [p] = goalProgress([g], [], [], [])
  assert.equal(p.pct, 0); assert.equal(p.gap, 0)
})

// ---- outreach dedup rule: 1 per company, follow-ups separate ---------------
t('outreachCount dedups by company across opportunities', () => {
  const opps = [opp({ id: 'o1', companyId: 'cA' }), opp({ id: 'o2', companyId: 'cA' }), opp({ id: 'o3', companyId: 'cB' })]
  const acts = [act({ id: 'a1', opportunityId: 'o1' }), act({ id: 'a2', opportunityId: 'o2' }), act({ id: 'a3', opportunityId: 'o3' }), act({ id: 'a4', opportunityId: 'o3', phase: 'follow-up' })]
  assert.equal(outreachCount(acts, opps), 2)
  assert.equal(followupCount(acts), 1)
})
t('outreachCount ignores orphan activities (deleted opp)', () => {
  assert.equal(outreachCount([act({ opportunityId: 'ghost' })], []), 0)
})

// ---- meeting had vs scheduled ----------------------------------------------
t('meetingStats: held meeting removes opp from scheduled', () => {
  const opps = [opp({ id: 'o1', status: 'Meeting scheduled' }), opp({ id: 'o2', status: 'Meeting scheduled' })]
  const s = meetingStats(opps, [mtg({ opportunityId: 'o1' })])
  assert.equal(s.had, 1); assert.equal(s.scheduled, 1)
})

// ---- funnel monotonicity under mixed statuses -------------------------------
t('funnel is monotonically non-increasing', () => {
  const opps = ['Prospect', 'Contacted', 'Contract signed', 'Lost', 'Negotiation', 'Follow-up']
    .map((s, i) => opp({ id: `o${i}`, status: s as Opportunity['status'] }))
  const f = funnel(opps)
  for (let i = 1; i < f.length; i++) assert.ok(f[i].count <= f[i - 1].count)
})

// ---- revenue & credit forecast ----------------------------------------------
t('revenue: received counts regardless of stage; receivable only sent/signed', () => {
  const r = revenue([
    opp({ id: 'o1', status: 'Contacted', value: 100, revenueReceived: true }),
    opp({ id: 'o2', status: 'Contract signed', value: 200 }),
    opp({ id: 'o3', status: 'Negotiation', value: 400 }),
  ])
  assert.equal(r.received, 100); assert.equal(r.receivable, 200)
})
t('pipelineValue excludes signed/lost/zero-value; weighted ≤ expected', () => {
  const p = pipelineValue([
    opp({ id: 'o1', status: 'Negotiation', value: 1000 }),
    opp({ id: 'o2', status: 'Contract signed', value: 999 }),
    opp({ id: 'o3', status: 'Lost', value: 999 }),
    opp({ id: 'o4', status: 'Prospect', value: 0 }),
  ])
  assert.equal(p.expected, 1000); assert.equal(p.weighted, 500)
})
t('receivablesByMonth: groups by expected month, unscheduled last, received/open excluded', () => {
  const rows = receivablesByMonth([
    opp({ id: 'o1', status: 'Contract signed', value: 100, expectedPaymentDate: '2026-09-15' }),
    opp({ id: 'o2', status: 'Contract sent', value: 50, expectedPaymentDate: '2026-09-01' }),
    opp({ id: 'o3', status: 'Contract signed', value: 70 }), // no date
    opp({ id: 'o4', status: 'Contract signed', value: 999, revenueReceived: true }), // already paid
    opp({ id: 'o5', status: 'Negotiation', value: 999 }), // not signed/sent yet
  ])
  assert.deepEqual(rows, [{ month: '2026-09', amount: 150 }, { month: '', amount: 70 }])
})
t('timeline books received revenue in the contract month', () => {
  const cons: Contract[] = [{ id: 'k1', opportunityId: 'o1', dateSent: '2026-05-02', dateSigned: '2026-06-15', daysUntilSigned: 44 }]
  const tl = timeline([], [], cons, [opp({ id: 'o1', value: 500, revenueReceived: true })])
  assert.equal(tl.find((p) => p.month === '2026-06')?.revenue, 500)
})

// ---- duplicate detection normalization --------------------------------------
t('duplicates: legal suffixes/punctuation collapse ("Odoo NV" ≈ "odoo.")', () => {
  const g = duplicateCompanyGroups([co({ id: 'c1', name: 'Odoo NV' }), co({ id: 'c2', name: 'odoo.' })], [
    opp({ id: 'o1', companyId: 'c1', lcId: 'lcA' }), opp({ id: 'o2', companyId: 'c2', lcId: 'lcB' }),
  ])
  assert.equal(g.length, 1); assert.equal(g[0].crossLc, true)
})
t('duplicates: all-suffix names ("The Group") never form a group', () => {
  assert.equal(duplicateCompanyGroups([co({ id: 'c1', name: 'The Group' }), co({ id: 'c2', name: 'Group The' })], []).length, 0)
})

// ---- reminders --------------------------------------------------------------
t('reminders: overdue + inactive fire; signed/lost stay silent', () => {
  const r = reminders([
    opp({ id: 'o1', nextActionDate: '2026-01-01', lastActivityAt: '2026-01-01' }),
    opp({ id: 'o2', status: 'Contract signed', nextActionDate: '2020-01-01' }),
  ], [], '2026-06-01')
  assert.ok(r.some((x) => x.kind === 'overdue' && x.opportunityId === 'o1'))
  assert.ok(r.some((x) => x.kind === 'inactive' && x.opportunityId === 'o1'))
  assert.ok(!r.some((x) => x.opportunityId === 'o2'))
})

// ---- performance rows -------------------------------------------------------
t('performanceByMember carries revenue + conversion', () => {
  const rows = performanceByMember(
    [opp({ id: 'o1', ownerId: 'u1', status: 'Contract signed', value: 300, revenueReceived: true })],
    [act({ opportunityId: 'o1' })], [], [usr({ id: 'u1', name: 'Tijs' })],
  )
  assert.equal(rows[0].revenue, 300); assert.equal(rows[0].conversion, 1)
})

// ---- status distribution covers every opp exactly once ----------------------
t('statusDistribution sums to opp count', () => {
  const opps = ['Lost', 'Prospect', 'Contacted'].map((s, i) => opp({ id: `o${i}`, status: s as Opportunity['status'] }))
  const d = statusDistribution(opps)
  assert.equal(Object.values(d).reduce((a, b) => a + b, 0), 3)
})

// ---- dates: ISO weeks + period windows across year boundaries ---------------
t('isoWeek: 2026-01-01 is week 1 of 2026; 2027-01-01 is week 53 of 2026', () => {
  assert.deepEqual(isoWeek(new Date(2026, 0, 1)), { year: 2026, week: 1 })
  assert.deepEqual(isoWeek(new Date(2027, 0, 1)), { year: 2026, week: 53 })
})
t('periodRange weekly W01 starts on a Monday and spans 7 days', () => {
  const { from, to } = periodRange('weekly', '2026-W01')
  assert.equal(new Date(from).getDay(), 1)
  assert.equal((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000, 6)
})
t('periodRange monthly handles 28/30/31-day months', () => {
  assert.equal(periodRange('monthly', '2026-02').to, '2026-02-28')
  assert.equal(periodRange('monthly', '2026-12').to, '2026-12-31')
})
t('currentPeriod semester: S1 Feb–Jul, S2 Aug–Jan (Jan → previous year S2)', () => {
  assert.equal(currentPeriod('semester', new Date(2026, 1, 1)), '2026-S1')  // Feb
  assert.equal(currentPeriod('semester', new Date(2026, 6, 31)), '2026-S1') // Jul
  assert.equal(currentPeriod('semester', new Date(2026, 7, 1)), '2026-S2')  // Aug
  assert.equal(currentPeriod('semester', new Date(2026, 0, 15)), '2025-S2') // Jan → prev S2
})
t('periodRange semester matches the AIESEC calendar (S2 spans year-end)', () => {
  assert.deepEqual(periodRange('semester', '2026-S1'), { from: '2026-02-01', to: '2026-07-31' })
  assert.deepEqual(periodRange('semester', '2026-S2'), { from: '2026-08-01', to: '2027-01-31' })
})
t('periodLabel round-trips each cadence', () => {
  assert.ok(periodLabel('weekly', '2026-W07').includes('7'))
  assert.ok(periodLabel('semester', '2026-S1').includes('S1'))
})
t('inMonthRange/inDayRange handle nulls + open ends', () => {
  assert.equal(inMonthRange(null, '', ''), false)
  assert.equal(inMonthRange('2026-06-15', '2026-06', ''), true)
  assert.equal(inDayRange('2026-06-15T10:00:00Z', '2026-06-01', '2026-06-30'), true)
})
t('availableMonths dedups + sorts', () => {
  assert.deepEqual(availableMonths(['2026-06-01', '2026-01-15', '2026-06-20', null]), ['2026-01', '2026-06'])
})

t('meetingStats: future meeting = scheduled, past = had; stage-only counts too', () => {
  const mkM = (id: string, oppId: string, date: string): Meeting =>
    ({ id, opportunityId: oppId, ownerId: 'u', date, number: 1, outcome: 'Held', nextAction: null })
  const opps = [
    opp({ id: 'a', status: 'Meeting scheduled' }), // has a FUTURE meeting → scheduled
    opp({ id: 'b', status: 'Meeting scheduled' }), // has a PAST meeting → had
    opp({ id: 'c', status: 'Meeting scheduled' }), // stage only, no row → scheduled
  ]
  const s = meetingStats(opps, [mkM('m1', 'a', '2999-01-01'), mkM('m2', 'b', '2000-01-01')], '2026-01-01')
  assert.equal(s.had, 1)
  assert.equal(s.scheduled, 2)
})

// ---- rbac -------------------------------------------------------------------
// Hierarchy: admin › lcp › lcvp › team_leader › member.
// member(mem) → tl → vp; outsider is a lone member in lc2.
const [admin, lcp, lcvp, tl, member, outsider] = [
  usr({ id: 'adm', role: 'admin', lcId: null }),
  usr({ id: 'lcp', role: 'lcp' }),
  usr({ id: 'vp', role: 'lcvp' }),
  usr({ id: 'tl', role: 'team_leader', teamLeadId: 'vp' }),
  usr({ id: 'mem', role: 'member', teamLeadId: 'tl' }),
  usr({ id: 'out', role: 'member', lcId: 'lc2' }),
]
const ALL = [admin, lcp, lcvp, tl, member, outsider]
t('supervisorsOf member = LC chain above (tl+vp+lcp) + every admin, never self/peers', () => {
  const s = supervisorsOf(member, ALL)
  assert.deepEqual([...s].sort(), ['adm', 'lcp', 'tl', 'vp'])
})
t('inactive supervisors are skipped', () => {
  const s = supervisorsOf(member, ALL.map((u) => (u.id === 'vp' ? { ...u, active: false } : u)))
  assert.ok(!s.includes('vp'))
})
t('goal hierarchy: admin→lcvp, lcvp→team_leader, tl→own member; lcp sets none', () => {
  assert.ok(canSetGoalFor(admin, lcvp) && canSetGoalFor(lcvp, tl) && canSetGoalFor(tl, member))
  assert.ok(!canSetGoalFor(lcp, lcvp) && !canSetGoalFor(lcvp, member) && !canSetGoalFor(tl, outsider) && !canSetGoalFor(member, member))
})
t('goalContributorIds: lcvp = whole LC, team_leader = self + own members', () => {
  assert.deepEqual([...goalContributorIds(lcvp, ALL)].sort(), ['lcp', 'mem', 'tl', 'vp'])
  assert.deepEqual([...goalContributorIds(tl, ALL)].sort(), ['mem', 'tl'])
})
t('visibility: member=self, lcp=whole LC, admin=null(all)', () => {
  assert.deepEqual([...visibleOwnerIds(member, ALL)!], ['mem'])
  assert.equal(visibleOwnerIds(admin, ALL), null)
  assert.ok(visibleOwnerIds(lcp, ALL)!.has('vp'))
})
t('canEditOwned: owner+admin only; scopeOpportunities respects it', () => {
  assert.ok(canEditOwned(admin, 'mem') && canEditOwned(member, 'mem'))
  assert.ok(!canEditOwned(lcvp, 'mem') && !canEditOwned(lcp, 'mem'))
  const scoped = scopeOpportunities(member, [opp({ ownerId: 'mem' }), opp({ id: 'o2', ownerId: 'out' })], ALL)
  assert.equal(scoped.length, 1)
})

// ---- csv injection/quoting ---------------------------------------------------
t('toCSV escapes quotes, commas, newlines, nulls', () => {
  const out = toCSV([['a"b', 'c,d', 'e\nf', null]])
  assert.equal(out, '"a""b","c,d","e\nf",""')
})

console.log(`\n${n} checks passed${process.exitCode ? ' (with failures above)' : ''}`)
