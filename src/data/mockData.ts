// Demo/mock data tools for the admin dashboard. Generates a believable spread
// of members, companies, pipeline, meetings and contracts across the LCs so the
// platform can be shown "in use", and clears it again. Everything is tagged
// (`usr_mock_*` / `mock_*`) so reset removes exactly the demo rows and never the
// real users or their data. Writes straight to Supabase (admin RLS lets this
// through), then re-hydrates so the UI + every other client reflect it.
import { isSupabaseConfigured, supabase, TABLE } from '@/lib/supabase'
import { hydrateFromSupabase } from './repositories'
import { OPPORTUNITY_STATUSES } from './types'
import type {
  Activity, ActivityOutcome, ActivityType, Company, Contact, Contract, Goal,
  GoalMetric, Meeting, Opportunity, OpportunityStatus, User,
} from './types'

const LC_IDS = ['lc_antwerp', 'lc_ghent', 'lc_leuven'] as const

const FIRST = ['Lore', 'Sanne', 'Wout', 'Elias', 'Femke', 'Jonas', 'Marie', 'Lucas', 'Noor', 'Milan', 'Fatima', 'Youssef', 'Emma', 'Arthur', 'Lina', 'Victor', 'Nour', 'Seppe', 'Amira', 'Thomas']
const LAST = ['Peeters', 'Janssens', 'Maes', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet', 'Jacobs', 'Mertens', 'Aerts', 'Hermans', 'Van Damme', 'Dubois', 'Lambert', 'Denis']
const SHARED_COMPANIES = ['Proximus', 'Colruyt Group'] // deliberately duplicated across LCs
const COMPANY_POOL = ['Barco', 'Umicore', 'Bekaert', 'Melexis', 'Ontex', 'Deceuninck', 'Agfa', 'Telenet', 'Elia', 'Recticel', 'Sofina', 'Aliaxis', 'Materialise', 'Odoo', 'Showpad', 'Collibra', 'Teamleader', 'Deliverect', 'Silverfin', 'Lighthouse']
const INDUSTRIES = ['Technology', 'Manufacturing', 'Retail', 'Finance', 'Logistics', 'Energy', 'Healthcare', 'Consulting']
const ROLES = ['HR Manager', 'CSR Lead', 'Talent Partner', 'CEO', 'Operations Director', 'People Lead']
const ACT_TYPES: ActivityType[] = ['LinkedIn', 'Email', 'Cold call', 'Follow-up', 'Meeting']
const ACT_OUTCOMES: ActivityOutcome[] = ['positive', 'neutral', 'no-response']
const MEETING_NOTES = ['Discussed iGT programme fit', 'Walked through pricing', 'Intro call, good energy', 'Reviewed timeline and roles', 'Aligned on next steps']

// weighted stage distribution — looks like a real funnel (fat top, few signed)
const STAGE_BAG: OpportunityStatus[] = ([
  ['Prospect', 5], ['Contacted', 5], ['Follow-up', 4], ['Meeting scheduled', 4],
  ['Negotiation', 3], ['Contract sent', 2], ['Contract signed', 3], ['Lost', 1],
] as [OpportunityStatus, number][]).flatMap(([s, w]) => Array<OpportunityStatus>(w).fill(s))

const rand = (n: number) => Math.floor(Math.random() * n)
const pick = <T>(a: readonly T[]): T => a[rand(a.length)]
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000))
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86400000))
const person = () => `${pick(FIRST)} ${pick(LAST)}`

function buildMock() {
  const users: User[] = []
  const companies: Company[] = []
  const contacts: Contact[] = []
  const opportunities: Opportunity[] = []
  const activities: Activity[] = []
  const meetings: Meeting[] = []
  const contracts: Contract[] = []
  const goals: Goal[] = []
  let coN = 0, ctN = 0, oppN = 0, actN = 0, mtgN = 0, conN = 0, goalN = 0

  const mkUser = (id: string, role: User['role'], lcId: string, teamLeadId: string | null, position: string): User => ({
    id, name: person(), email: `${id.replace(/_/g, '.')}@mock.aiesec.be`,
    role, lcId, position, teamLeadId, active: true, phone: null, status: 'approved',
  })

  LC_IDS.forEach((lcId, li) => {
    const slug = lcId.replace('lc_', '')
    const lcpId = `usr_mock_${slug}_lcp`
    const lcvpId = `usr_mock_${slug}_lcvp`
    // leaders first (members reference the lcvp as team lead → must precede them)
    users.push(mkUser(lcpId, 'lcp', lcId, null, 'LC President'))
    users.push(mkUser(lcvpId, 'lcvp', lcId, null, 'LCVP Sales'))
    // Team leaders report to the LCVP; members are split across them.
    const tlIds: string[] = []
    for (let t = 0; t < 2; t++) {
      const tlId = `usr_mock_${slug}_tl${t}`
      users.push(mkUser(tlId, 'team_leader', lcId, lcvpId, 'Team Leader'))
      tlIds.push(tlId)
    }
    const memberIds: string[] = []
    for (let m = 0; m < 4; m++) {
      const id = `usr_mock_${slug}_m${m}`
      users.push(mkUser(id, 'member', lcId, tlIds[m % tlIds.length], 'iGT Member'))
      memberIds.push(id)
    }

    // companies (first two are the shared/duplicate names) + a contact each
    const lcCompanyIds: string[] = []
    for (let ci = 0; ci < 10; ci++) {
      const id = `mock_co_${coN++}`
      const name = ci < SHARED_COMPANIES.length ? SHARED_COMPANIES[ci] : pick(COMPANY_POOL)
      companies.push({ id, name, industry: pick(INDUSTRIES), country: 'Belgium', website: null, linkedin: null, notes: null })
      contacts.push({ id: `mock_ct_${ctN++}`, companyId: id, name: person(), role: pick(ROLES), email: null, phone: null, linkedin: null })
      lcCompanyIds.push(id)
    }

    // opportunities for every member + the LCVP (own pipeline), with matching
    // activities / meetings / contracts so the funnel + charts are coherent.
    for (const ownerId of [...memberIds, ...tlIds, lcvpId]) {
      const count = 3 + rand(4)
      for (let o = 0; o < count; o++) {
        const status = pick(STAGE_BAG)
        const stageIdx = OPPORTUNITY_STATUSES.indexOf(status)
        const companyId = pick(lcCompanyIds)
        const contactId = contacts.find((c) => c.companyId === companyId)?.id ?? null
        const oppId = `mock_opp_${oppN++}`
        opportunities.push({
          id: oppId, companyId, contactId, ownerId, lcId, status,
          value: status === 'Prospect' ? 0 : 1000 + rand(9) * 500,
          revenueReceived: status === 'Contract signed' && Math.random() < 0.6,
          nextAction: null, nextActionDate: null,
          expectedPaymentDate: stageIdx >= 5 ? daysFromNow(rand(60)) : null,
          lastActivityAt: daysAgo(rand(21)), createdAt: daysAgo(30 + rand(120)), updatedAt: daysAgo(rand(14)),
        })
        for (let a = 0, na = 1 + rand(3); a < na; a++) {
          activities.push({
            id: `mock_act_${actN++}`, opportunityId: oppId, ownerId, type: pick(ACT_TYPES),
            phase: a === 0 ? 'first' : 'follow-up', count: 1, outcome: pick(ACT_OUTCOMES),
            date: daysAgo(rand(120)), notes: null,
          })
        }
        if (stageIdx >= 3 && status !== 'Lost') {
          for (let mm = 0, nm = 1 + rand(2); mm < nm; mm++) {
            meetings.push({
              id: `mock_mtg_${mtgN++}`, opportunityId: oppId, ownerId, date: daysAgo(rand(90)),
              number: mm + 1, outcome: 'Held', nextAction: null, notes: pick(MEETING_NOTES),
            })
          }
        }
        if (stageIdx >= 5 && status !== 'Lost') {
          const signed = status === 'Contract signed'
          contracts.push({
            id: `mock_con_${conN++}`, opportunityId: oppId, dateSent: daysAgo(20 + rand(40)),
            dateSigned: signed ? daysAgo(rand(20)) : null, daysUntilSigned: signed ? 5 + rand(20) : null,
          })
        }
      }
    }

    // goals across the hierarchy so every role's Goals page shows targets:
    // LC targets (LCVP-owned), team-leader targets, and per-member targets.
    const targets: Record<GoalMetric, number> = { outreaches: 40, meetings: 30, contracts: 10, revenue: 30000 }
    ;(Object.keys(targets) as GoalMetric[]).forEach((metric) => {
      goals.push({ id: `mock_goal_${goalN++}`, scope: 'lc', ownerId: lcvpId, lcId, period: '2026-S1', cadence: 'semester', metric, planned: targets[metric] })
    })
    for (const tlId of tlIds) {
      goals.push({ id: `mock_goal_${goalN++}`, scope: 'member', ownerId: tlId, lcId, period: '2026-S1', cadence: 'semester', metric: 'meetings', planned: 15 + rand(10) })
      goals.push({ id: `mock_goal_${goalN++}`, scope: 'member', ownerId: tlId, lcId, period: '2026-S1', cadence: 'semester', metric: 'outreaches', planned: 20 + rand(15) })
    }
    for (const mid of memberIds) {
      goals.push({ id: `mock_goal_${goalN++}`, scope: 'member', ownerId: mid, lcId, period: '2026-S1', cadence: 'semester', metric: 'meetings', planned: 8 + rand(8) })
    }
  })

  return { users, companies, contacts, opportunities, activities, meetings, contracts, goals }
}

// Insert in FK order. Bulk insert per table (one round-trip each).
const INSERT_ORDER = ['users', 'companies', 'contacts', 'opportunities', 'activities', 'meetings', 'contracts', 'goals'] as const

/** Generate a fresh demo dataset (clears any previous mock first). Returns row counts. */
export async function generateMockData(): Promise<{ users: number; opportunities: number }> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  await resetMockData()
  const data = buildMock()
  for (const key of INSERT_ORDER) {
    const rows = data[key] as object[]
    if (rows.length) {
      const { error } = await supabase.from(TABLE[key]).insert(rows)
      if (error) throw error
    }
  }
  await hydrateFromSupabase()
  return { users: data.users.length, opportunities: data.opportunities.length }
}

/** Remove every mock-tagged row (keeps real users + any real data). */
export async function resetMockData(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  // children → parents so foreign keys stay satisfied
  const tables = ['activities', 'meetings', 'contracts', 'opportunities', 'goals', 'contacts', 'companies']
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().like('id', 'mock_%')
    if (error) throw error
  }
  // users last; null the self-referential team lead first so the delete is FK-safe
  await supabase.from(TABLE.users).update({ teamLeadId: null }).like('id', 'usr_mock_%')
  const { error } = await supabase.from(TABLE.users).delete().like('id', 'usr_mock_%')
  if (error) throw error
  await hydrateFromSupabase()
}
