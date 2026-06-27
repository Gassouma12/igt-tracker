// Per-entity async CRUD. The in-memory store stays the reactive source of truth
// (so the UI updates instantly); when Supabase is configured, writes are also
// mirrored to Postgres and `hydrateFromSupabase()` loads live data on startup.
// Not configured => pure mock, exactly as before.

import { db, useDB } from './store'
import type { DB, EntityKey } from './types'
import { isSupabaseConfigured, supabase, TABLE } from '@/lib/supabase'

type Identified = { id: string }

// Mirror a write to Supabase when configured. Errors are logged, not thrown, so
// a transient backend issue never blocks the local (reactive) update.
async function mirror(run: () => PromiseLike<{ error: unknown }>): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await run()
    if (error) console.error('[supabase] write failed', error)
  } catch (e) {
    console.error('[supabase] write threw', e)
  }
}

function makeRepo<K extends keyof DB, T extends Identified = DB[K][number]>(key: K) {
  const table = TABLE[key as EntityKey]
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
      await mirror(() => supabase!.from(table).insert(item as object))
      return item
    },
    async update(id: string, patch: Partial<T>): Promise<T | undefined> {
      const next = read().map((r) => (r.id === id ? { ...r, ...patch } : r))
      useDB.getState().patch({ [key]: next } as Partial<DB>)
      await mirror(() => supabase!.from(table).update(patch as object).eq('id', id))
      return next.find((r) => r.id === id)
    },
    async remove(id: string): Promise<void> {
      useDB.getState().patch({ [key]: read().filter((r) => r.id !== id) } as Partial<DB>)
      await mirror(() => supabase!.from(table).delete().eq('id', id))
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
  notifications: makeRepo('notifications'),
}

/**
 * Replace the in-memory store with live Supabase data. Call once at startup
 * (main.tsx) when configured; no-op otherwise. Columns match the entity field
 * names exactly, so rows drop straight into the store.
 */
export async function hydrateFromSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false
  try {
    const keys = Object.keys(TABLE) as EntityKey[]
    const results = await Promise.all(keys.map((k) => supabase!.from(TABLE[k]).select('*')))
    const next: Partial<DB> = {}
    keys.forEach((k, i) => {
      const { data, error } = results[i]
      if (error) throw error
      // Only replace a table when Supabase actually has rows — so an empty (not
      // yet seeded) project keeps the bundled demo data instead of going blank.
      if (data && data.length) (next as Record<string, unknown>)[k] = data
    })
    if (Object.keys(next).length) useDB.getState().patch(next)
    return true
  } catch (e) {
    console.error('[supabase] hydrate failed — staying on local data', e)
    return false
  }
}
