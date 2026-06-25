// Per-entity async CRUD. Today these read/write the local store; the async
// signatures match what a Supabase-backed implementation would expose, so the
// migration is a body-swap (return supabase.from(key).select()/insert()/...).

import { db, useDB } from './store'
import type { DB } from './types'

type Identified = { id: string }

function makeRepo<K extends keyof DB, T extends Identified = DB[K][number]>(key: K) {
  const read = () => db()[key] as unknown as T[]
  return {
    async list(): Promise<T[]> {
      return read()
    },
    async get(id: string): Promise<T | undefined> {
      return read().find((r) => r.id === id)
    },
    async create(item: T): Promise<T> {
      useDB.getState().patch({ [key]: [...read(), item] } as Partial<DB>)
      return item
    },
    async update(id: string, patch: Partial<T>): Promise<T | undefined> {
      const next = read().map((r) => (r.id === id ? { ...r, ...patch } : r))
      useDB.getState().patch({ [key]: next } as Partial<DB>)
      return next.find((r) => r.id === id)
    },
    async remove(id: string): Promise<void> {
      useDB.getState().patch({ [key]: read().filter((r) => r.id !== id) } as Partial<DB>)
    },
  }
}

export const repo = {
  users: makeRepo('users'),
  localCommittees: makeRepo('localCommittees'),
  companies: makeRepo('companies'),
  contacts: makeRepo('contacts'),
  opportunities: makeRepo('opportunities'),
  activities: makeRepo('activities'),
  meetings: makeRepo('meetings'),
  contracts: makeRepo('contracts'),
  goals: makeRepo('goals'),
  activityLog: makeRepo('activityLog'),
}
