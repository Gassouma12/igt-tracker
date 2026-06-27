// Realtime sync: subscribe to Postgres changes on every table and patch the
// in-memory store so inserts/updates/deletes from OTHER users (e.g. an LCVP
// approving a member, a member logging a meeting) show up live for everyone.
// No-op unless Supabase is configured. Requires the tables to be in the
// `supabase_realtime` publication (see supabase/realtime.sql).

import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, useDB } from './store'
import type { DB, EntityKey } from './types'
import { isSupabaseConfigured, supabase, TABLE } from '@/lib/supabase'

const KEY_BY_TABLE = Object.fromEntries(
  Object.entries(TABLE).map(([k, t]) => [t, k as EntityKey]),
) as Record<string, EntityKey>

export function startRealtime(): RealtimeChannel | null {
  if (!isSupabaseConfigured || !supabase) return null

  const channel = supabase.channel('igt-db-changes')
  // `.on('postgres_changes', ...)` needs generated DB types to be strongly typed;
  // we don't generate them, so go through a loosely-typed handle.
  const on = channel.on.bind(channel) as (
    type: string,
    filter: { event: string; schema: string; table: string },
    cb: (payload: { eventType: string; new: { id: string }; old: { id: string } }) => void,
  ) => typeof channel

  for (const table of Object.values(TABLE)) {
    on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      const key = KEY_BY_TABLE[table]
      const rows = db()[key] as { id: string }[]
      if (payload.eventType === 'INSERT') {
        const r = payload.new
        if (!rows.some((x) => x.id === r.id)) patch(key, [...rows, r])
      } else if (payload.eventType === 'UPDATE') {
        const r = payload.new
        patch(key, rows.map((x) => (x.id === r.id ? { ...x, ...r } : x)))
      } else if (payload.eventType === 'DELETE') {
        patch(key, rows.filter((x) => x.id !== payload.old.id))
      }
    })
  }
  channel.subscribe()
  return channel
}

function patch(key: EntityKey, rows: unknown[]) {
  useDB.getState().patch({ [key]: rows } as Partial<DB>)
}
