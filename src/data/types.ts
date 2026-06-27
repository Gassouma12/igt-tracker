// Domain entities. Foreign keys are plain id strings so the same shapes map
// 1:1 onto Supabase tables later (the repository layer is the only thing that
// changes). String-union types instead of enums (tsconfig: erasableSyntaxOnly).

export type Role = 'admin' | 'lcp' | 'lcvp' | 'member'

export const OPPORTUNITY_STATUSES = [
  'Prospect',
  'Contacted',
  'Follow-up',
  'Meeting scheduled',
  'Negotiation',
  'Contract sent',
  'Contract signed',
  'Lost',
] as const
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number]

export type ActivityType = 'LinkedIn' | 'Email' | 'Cold call' | 'Follow-up' | 'Meeting'
export type ActivityPhase = 'first' | 'follow-up' | 'meeting'
export type ActivityOutcome = 'positive' | 'neutral' | 'no-response'
export type GoalMetric = 'outreaches' | 'meetings' | 'contracts'
export type GoalScope = 'member' | 'lc' | 'global'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  lcId: string | null
  position: string
  teamLeadId: string | null
  active: boolean
}

export interface LocalCommittee {
  id: string
  name: string
  country: string
  lcpId: string | null
  lcvpIds: string[]
}

export interface Company {
  id: string
  name: string
  industry: string | null
  country: string | null
  website: string | null
  linkedin: string | null
  notes: string | null
}

export interface Contact {
  id: string
  companyId: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
}

export interface Opportunity {
  id: string
  companyId: string
  contactId: string | null
  ownerId: string
  lcId: string
  status: OpportunityStatus
  nextAction: string | null
  nextActionDate: string | null
  lastActivityAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface Activity {
  id: string
  opportunityId: string
  ownerId: string
  type: ActivityType
  phase: ActivityPhase
  count: number
  outcome: ActivityOutcome
  date: string | null
  notes: string | null
}

export interface Meeting {
  id: string
  opportunityId: string
  ownerId: string
  date: string | null
  number: number
  outcome: string | null
  nextAction: string | null
}

export interface Contract {
  id: string
  opportunityId: string
  dateSent: string | null
  dateSigned: string | null
  daysUntilSigned: number | null
}

export interface Goal {
  id: string
  scope: GoalScope
  ownerId: string | null
  lcId: string | null
  period: string
  metric: GoalMetric
  planned: number
}

export interface LogEntry {
  id: string
  actorId: string
  entity: string
  entityId: string
  action: string
  from: string | null
  to: string | null
  at: string
}

export type NotificationKind = 'meeting' | 'contract'

/** Stored, targeted notification (vs the derived reminders in metrics.ts). */
export interface Notification {
  id: string
  recipientId: string
  actorId: string
  opportunityId: string
  kind: NotificationKind
  message: string
  read: boolean
  at: string
}

export interface DB {
  users: User[]
  localCommittees: LocalCommittee[]
  companies: Company[]
  contacts: Contact[]
  opportunities: Opportunity[]
  activities: Activity[]
  meetings: Meeting[]
  contracts: Contract[]
  goals: Goal[]
  activityLog: LogEntry[]
  notifications: Notification[]
}

export type EntityKey = keyof DB
