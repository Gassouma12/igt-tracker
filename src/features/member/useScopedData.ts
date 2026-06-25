// Reactive, RBAC-scoped slice of the data for the signed-in user. Member sees
// only their own records; lcvp/lcp/admin see progressively wider scopes (the
// same hook powers any "my workspace" view regardless of role).

import { useMemo } from 'react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { scopeOpportunities } from '@/lib/rbac'
import type { Activity, Company, Contact, Contract, Meeting, Opportunity, User } from '@/data/types'

export interface ScopedData {
  user: User | null
  opportunities: Opportunity[]
  activities: Activity[]
  meetings: Meeting[]
  contracts: Contract[]
  companies: Company[]
  contacts: Contact[]
  companyById: (id: string) => Company | undefined
  contactById: (id: string | null) => Contact | undefined
  oppById: (id: string) => Opportunity | undefined
}

export function useScopedData(): ScopedData {
  const user = useCurrentUser()
  const allOpps = useDB((s) => s.opportunities)
  const allActs = useDB((s) => s.activities)
  const allMeetings = useDB((s) => s.meetings)
  const allContracts = useDB((s) => s.contracts)
  const companies = useDB((s) => s.companies)
  const contacts = useDB((s) => s.contacts)
  const users = useDB((s) => s.users)

  return useMemo(() => {
    const opportunities = user ? scopeOpportunities(user, allOpps, users) : []
    const oppIds = new Set(opportunities.map((o) => o.id))
    const companyMap = new Map(companies.map((c) => [c.id, c]))
    const contactMap = new Map(contacts.map((c) => [c.id, c]))
    const oppMap = new Map(opportunities.map((o) => [o.id, o]))
    return {
      user,
      opportunities,
      activities: allActs.filter((a) => oppIds.has(a.opportunityId)),
      meetings: allMeetings.filter((m) => oppIds.has(m.opportunityId)),
      contracts: allContracts.filter((c) => oppIds.has(c.opportunityId)),
      companies,
      contacts,
      companyById: (id) => companyMap.get(id),
      contactById: (id) => (id ? contactMap.get(id) : undefined),
      oppById: (id) => oppMap.get(id),
    }
  }, [user, allOpps, allActs, allMeetings, allContracts, companies, contacts, users])
}
