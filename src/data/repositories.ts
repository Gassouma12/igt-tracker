// Per-entity async CRUD. The in-memory store stays the reactive source of truth
// (so the UI updates instantly); when Supabase is configured, writes are also
// mirrored to Postgres and `hydrateFromSupabase()` loads live data on startup.
// Not configured => pure mock, exactly as before.

import { db, useDB } from './store'
import type { DB, EntityKey } from './types'
import { isSupabaseConfigured, supabase, TABLE, useSupabaseAuth } from '@/lib/supabase'
import { toast } from '@/lib/toast'

type Identified = { id: string }

const SAVE_FAILED = "Couldn't save your change to the server — check your connection and try again."

// Mirror a write to Supabase when configured. Returns whether it succeeded, so
// the caller can revert its optimistic local update instead of silently keeping
// a change the server rejected. Never throws — a failure is reported, not fatal.
async function mirror(run: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
  if (!isSupabaseConfigured) return true
  try {
    const { error } = await run()
    if (error) { console.error('[supabase] write failed', error); return false }
    return true
  } catch (e) {
    console.error('[supabase] write threw', e)
    return false
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
    // Each write updates the store first (instant UI), then mirrors to Supabase.
    // On failure we roll the store back to `prev` so the UI reflects what the
    // server actually holds, and toast the user. ponytail: `prev` snapshot is
    // fine for this app's sequential single-user edits; concurrent in-flight
    // writes to the same table could race — add per-entity queueing if that bites.
    async create(item: T): Promise<T> {
      const prev = read()
      useDB.getState().patch({ [key]: [...prev, item] } as Partial<DB>)
      const ok = await mirror(() => supabase!.from(table).insert(item as object))
      if (!ok) { useDB.getState().patch({ [key]: prev } as Partial<DB>); toast.error(SAVE_FAILED) }
      return item
    },
    async update(id: string, patch: Partial<T>): Promise<T | undefined> {
      const prev = read()
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      useDB.getState().patch({ [key]: next } as Partial<DB>)
      const ok = await mirror(() => supabase!.from(table).update(patch as object).eq('id', id))
      if (!ok) { useDB.getState().patch({ [key]: prev } as Partial<DB>); toast.error(SAVE_FAILED) }
      return (ok ? next : prev).find((r) => r.id === id)
    },
    async remove(id: string): Promise<void> {
      const prev = read()
      useDB.getState().patch({ [key]: prev.filter((r) => r.id !== id) } as Partial<DB>)
      const ok = await mirror(() => supabase!.from(table).delete().eq('id', id))
      if (!ok) { useDB.getState().patch({ [key]: prev } as Partial<DB>); toast.error(SAVE_FAILED) }
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
      // Real-auth (production): the DB is the whole truth — adopt every table
      // even when empty, so a clean project starts empty instead of showing the
      // bundled demo. Demo/linked mode keeps the seed for empty tables so the
      // unseeded demo still works.
      if (useSupabaseAuth) (next as Record<string, unknown>)[k] = data ?? []
      else if (data && data.length) (next as Record<string, unknown>)[k] = data
    })
    if (Object.keys(next).length) useDB.getState().patch(next)
    return true
  } catch (e) {
    console.error('[supabase] hydrate failed — staying on local data', e)
    return false
  }
}
