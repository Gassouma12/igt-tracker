// In-memory reactive store, seeded from the migrated JSON and persisted to
// localStorage so edits survive reloads. This is the ONLY place that knows the
// data is local — repositories talk to it through a stable async API, so the
// Supabase swap later means rewriting repositories.ts, not the UI.

import { create } from 'zustand'
import type {
  Activity, Company, Contact, Contract, DB, Goal, LocalCommittee, LogEntry,
  Meeting, Notification, Opportunity, User,
} from './types'

import users from './seed/users.json'
import localCommittees from './seed/localCommittees.json'
import companies from './seed/companies.json'
import contacts from './seed/contacts.json'
import opportunities from './seed/opportunities.json'
import activities from './seed/activities.json'
import meetings from './seed/meetings.json'
import contracts from './seed/contracts.json'
import goals from './seed/goals.json'

const STORAGE_KEY = 'igt.db.v1'

function seedDB(): DB {
  return {
    users: users as User[],
    localCommittees: localCommittees as LocalCommittee[],
    companies: companies as Company[],
    contacts: contacts as Contact[],
    opportunities: opportunities as Opportunity[],
    activities: activities as Activity[],
    meetings: meetings as Meeting[],
    contracts: contracts as Contract[],
    goals: goals as Goal[],
    activityLog: [] as LogEntry[],
    notifications: [] as Notification[],
  }
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...seedDB(), ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt cache, fall back to seed */
  }
  return seedDB()
}

const ENTITY_KEYS: (keyof DB)[] = [
  'users', 'localCommittees', 'companies', 'contacts', 'opportunities',
  'activities', 'meetings', 'contracts', 'goals', 'activityLog', 'notifications',
]

function persist(db: DB) {
  const slim: Partial<DB> = {}
  for (const k of ENTITY_KEYS) (slim as Record<string, unknown>)[k] = db[k]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch {
    /* over-quota: keep working in memory */
  }
}

interface Store extends DB {
  patch: (p: Partial<DB>) => void
  reset: () => void
}

export const useDB = create<Store>((set, get) => ({
  ...loadDB(),
  patch: (p) =>
    set(() => {
      const next = { ...get(), ...p } as Store
      persist(next)
      return p
    }),
  reset: () => {
    localStorage.removeItem(STORAGE_KEY)
    const fresh = seedDB()
    set(fresh)
  },
}))

/** Non-reactive snapshot for repositories / pure metric calls. */
export const db = () => useDB.getState()

/** Monotonic-ish id generator for new records. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
