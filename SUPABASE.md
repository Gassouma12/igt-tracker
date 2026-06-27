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

## Activation checklist (this project)

`.env` is already filled in with the project URL + publishable key, so the DB is
**linked** (the app hydrates from it; an empty DB keeps the bundled demo data).
To go fully live — seeded data, real logins, realtime — do these in order:

**1. Create the tables** — SQL Editor → run `supabase/schema.sql`.

**2. Seed the data** — SQL Editor → run `supabase/seed.sql` (auto-generated from
the migrated spreadsheet; regenerate with `node scripts/gen-seed-sql.mjs`). This
loads the 3 LCs, users, ~companies/opportunities/activities/meetings/contracts.
> The publishable (anon) key **can't** insert (RLS) — that's why seeding goes
> through the SQL editor, which bypasses RLS.

**3. Enable realtime** — SQL Editor → run `supabase/realtime.sql` (adds the tables
to the `supabase_realtime` publication). The app already subscribes on startup.

**4. Upload the images** to the `images` bucket. Either drag `src/images/bg.png`
and `gem.png` into the bucket in the dashboard, **or**:
```bash
SUPABASE_SERVICE_ROLE_KEY=<service_role key> node scripts/upload-images.mjs
```
(The anon key can't upload — needs the service role key from *Settings → API*.)
> The app currently bundles these images, so it looks right regardless; this step
> is only if you want them served from the bucket.

**5. Turn on real auth.** In *Authentication → Providers → Email*, **disable
"Confirm email"** (so sign-up logs the user straight into the pending screen).
Then in `.env` set `VITE_USE_SUPABASE_AUTH=true` and restart `npm run dev`.

**6. Bootstrap the first admin.** Sign up once via the app (it lands on the
pending screen), then in SQL Editor:
```sql
update users set role = 'admin', status = 'approved' where email = 'you@aiesec.be';
```
Re-open the app — you now have the **Approvals** tab to approve everyone else.

> **GitHub Pages:** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and
> `VITE_USE_SUPABASE_AUTH`) as repository **Actions secrets**, and pass them to
> the build step in `.github/workflows/deploy.yml`
> (`env: VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}` …).

## What's wired in code

- **Link + load**: `src/lib/supabase.ts` (client), `hydrateFromSupabase()` in
  `repositories.ts` (loads tables on startup; keeps seed if a table is empty).
- **Write-through**: every `repo.*.create/update/remove` mirrors to Postgres.
- **Realtime**: `src/data/realtime.ts` subscribes to all tables and patches the
  store, so an LCVP and a member see each other's changes live.
- **Auth**: `signUp` / `signInWithPassword` in `actions.ts`, session sync in
  `state/session.ts` — all behind `useSupabaseAuth` (the env flag).

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
