// Supabase client + the entity-key -> table-name map. Configured purely via
// env vars, so the app runs on the in-memory mock until you point it at a real
// project (see SUPABASE.md). When the env vars are absent, `supabase` is null
// and every Supabase code path is skipped — the mock layer is untouched.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { EntityKey } from '@/data/types'

const env = import.meta.env as Record<string, string | undefined>
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, anonKey!) : null

// Postgres table per store entity. Columns are named EXACTLY like the TypeScript
// fields (quoted camelCase in the schema), so rows map 1:1 onto the entities and
// no field-renaming layer is needed.
export const TABLE: Record<EntityKey, string> = {
  users: 'users',
  localCommittees: 'local_committees',
  companies: 'companies',
  contacts: 'contacts',
  opportunities: 'opportunities',
  activities: 'activities',
  meetings: 'meetings',
  contracts: 'contracts',
  goals: 'goals',
  activityLog: 'activity_log',
  notifications: 'notifications',
}
