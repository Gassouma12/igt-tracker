# Linking the iGT Platform to Supabase

The app ships running on bundled mock data. The data layer is built as a swappable
seam, so connecting Supabase is configuration + one SQL run — **no UI or metrics
changes**. When the two env vars are set, the app loads live data on startup and
mirrors every write back to Postgres.

## Architecture (the seam)

```
UI (reads, reactive)
        │
   useDB (Zustand in-memory store)  ◄── source of truth for rendering
        ▲                │
        │ hydrateFromSupabase()      │ write-through
        │ (startup, once)            ▼
   ┌────┴───────────────────────────────────┐
   │  src/data/repositories.ts               │
   │  • create/update/remove → store + mirror│
   │  • hydrateFromSupabase() → load tables  │
   └──────────────┬──────────────────────────┘
                  │  src/lib/supabase.ts (client, TABLE map)
                  ▼
          Supabase / Postgres
```

- **`src/lib/supabase.ts`** — creates the client from env; `isSupabaseConfigured`
  is false when env is missing, and every Supabase path is skipped.
- **`src/data/repositories.ts`** — the store stays the reactive source of truth;
  writes are mirrored to Postgres, and `hydrateFromSupabase()` replaces the seed
  with live rows at startup (`main.tsx`).
- **`supabase/schema.sql`** — the exact data model. Columns are quoted camelCase
  so rows map 1:1 onto `src/data/types.ts` — no field-mapping layer.

## Steps

### 1. Create a project
[supabase.com](https://supabase.com) → New project. Note the **Project URL** and
**anon public key** under *Settings → API*.

### 2. Create the database
Open *SQL Editor* → paste `supabase/schema.sql` → **Run**. This creates all 11
tables, indexes, FKs, the per-cadence unique goal index, and enables RLS with
permissive starter policies.

### 3. (Optional) Seed it with the migrated data
The current demo data lives in `src/data/seed/*.json`. Quick load:
```sql
-- In SQL editor, for each table, paste rows. Or script it:
-- node scripts/seed-supabase.mjs   (write this using @supabase/supabase-js
-- service-role key + the JSON files; insert in FK order: local_committees,
-- users, companies, contacts, opportunities, activities, meetings, contracts,
-- goals). Keys match column names, so it's a direct insert.
```

### 4. Point the app at it
```bash
cp .env.example .env
# fill in:
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
npm run dev
```
On boot the app calls `hydrateFromSupabase()` and shows live data; writes mirror
to Postgres. With env unset it stays on mock data.

> For GitHub Pages, add the two vars as repository **Actions secrets** and expose
> them to the build step in `.github/workflows/deploy.yml`
> (`env: VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}` …).

## Auth & RLS (next step, when you want real logins)

Today login is mock (pick a user by email). To go live:
1. Use **Supabase Auth** (email magic link / OAuth). On first sign-in, upsert a
   row in `users` keyed by `auth.uid()` (set `users.id = auth.uid()`).
2. Replace the body of `src/state/session.ts` `login/logout` with
   `supabase.auth.signInWithOtp` / `signOut`; `useCurrentUser` then reads the
   session user. The rest of the app is unaffected.
3. Tighten RLS: swap the permissive `*_auth_all` policies for scoped ones that
   mirror `src/lib/rbac.ts` (an example for `opportunities` is in the schema).
4. The **pending-approval** flow already exists in the app (`users.status`);
   keep new sign-ups as `status = 'pending'` and gate access in RLS too if you
   want server-side enforcement.
