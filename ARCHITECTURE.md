# Architecture

Single-page React 19 + TypeScript app (Vite, rolldown), dark-first Tailwind,
client-side domain logic, with a **swappable data seam**: the same UI runs on a
bundled mock dataset or live Supabase (Postgres + Auth + Realtime) purely by env.

## Data flow

```
                    ┌────────────────────────────────────────────┐
                    │  UI (features/*) — reads via useDB selectors│
                    └───────▲───────────────────────┬────────────┘
                            │ reactive               │ user intent
                    ┌───────┴────────┐      ┌────────▼────────┐
                    │ Zustand store  │      │ data/actions.ts │  domain mutations:
                    │ data/store.ts  │◄─────│  (smart layer)  │  audit log, notify(),
                    │ localStorage-  │      └────────┬────────┘  derived fields, bump()
                    │ persisted      │               │
                    └───────▲────────┘      ┌────────▼────────────┐
        hydrate (startup)   │               │ data/repositories.ts│ per-entity async CRUD
        ┌───────────────────┴──────┐        │ local write + mirror│
        │ data/realtime.ts         │        └────────┬────────────┘
        │ postgres_changes → patch │                 │ when isSupabaseConfigured
        └───────────▲──────────────┘        ┌────────▼────────┐
                    └───────────────────────│ Supabase (PG)   │ eu-west-1
                                            └─────────────────┘
```

- **Store is source of truth for rendering** — writes land locally first (instant
  UI), then mirror to Postgres (fire-and-forget, logged on failure).
- **hydrateFromSupabase()** (main.tsx) replaces only tables that have rows in the
  DB — an unseeded project keeps demo data instead of going blank.
- **realtime.ts** subscribes to all 11 tables; INSERT dedups by id (so a client's
  own mirrored write echoing back is a no-op), UPDATE merges, DELETE filters.
- **Cross-tab (same browser) sync relies on realtime**, not storage events — two
  tabs in pure mock mode do not sync.

## Modules

| Path | Role |
|---|---|
| `src/data/types.ts` | All entities; string unions (no enums); FKs are plain id strings |
| `src/data/store.ts` | Zustand DB, seeded from `seed/*.json`, `igt.db.v1` persistence, `reset()` |
| `src/data/actions.ts` | Every mutation: audit trail, notifications, status bump, goal upsert, signUp/status |
| `src/data/repositories.ts` | CRUD seam + hydrate; the ONLY file that would change for another backend |
| `src/data/realtime.ts` | Live sync subscription |
| `src/lib/rbac.ts` | All access rules (visibility/edit/goals/assignment) — future RLS mirror |
| `src/lib/metrics.ts` | Pure roll-ups: kpis, funnel, conversions (adjacent + milestone), rankings, revenue, pipelineValue, duplicates, reminders, timeline |
| `src/lib/dates.ts` | Month ranges + goal cadence periods (ISO weeks, LOCAL-date windows) |
| `src/lib/supabase.ts` | Client + `TABLE` map (entity key → table name) + env gates |
| `src/state/` | session (mock login or Supabase-auth-synced), filters, focus (notification → row pulse) |
| `src/features/` | auth / admin / lc / member / shared pages (lazy routes in App.tsx, RoleRoute-guarded) |
| `scripts/` | ETL (xlsx→JSON), seed-SQL generator, one-shot Supabase setup, image upload, **audit-tests.mts** |
| `supabase/` | `schema.sql` (DDL, quoted-camelCase, RLS), `seed.sql` (org only), `realtime.sql` |

## Auth modes

1. **Mock (default)** — `login(userId)` picks a seeded user; quick sign-in buttons +
   demo identity switcher visible. Any password accepted.
2. **Real (`VITE_USE_SUPABASE_AUTH=true`)** — email+password via supabase.auth;
   profile row keyed on `auth.uid()`; session synced by `onAuthStateChange`;
   demo affordances hidden. Sign-up creates a `pending` profile → `AccountPending`
   gate in `RequireAuth` until an admin approves (Approvals tab).

## Database (supabase/schema.sql)

11 tables mirroring the entities 1:1 (quoted camelCase). Notable constraints:
text-CHECK enums, `goals` unique index on (ownerId, metric, cadence, period) for
member scope, FKs with cascade/set-null, indexes on owner/lc/company/opportunity.
RLS enabled everywhere with permissive `authenticated`-ALL starter policies —
**tightening to mirror rbac.ts is the gating item for real rollout** (a scoped
example is commented in the schema). Realtime publication contains all 11 tables.

## Deployment

Push to main → GitHub Actions (`deploy.yml`) → `vite build` (Supabase env from
Actions secrets; empty ⇒ demo mode) → `peaceiris/actions-gh-pages` → gh-pages
branch → https://gassouma12.github.io/igt-tracker/. SPA routing via 404.html
sessionStorage redirect; router basename from `import.meta.env.BASE_URL`.

## Performance posture

Client-side pagination (25/page) everywhere; memoized roll-ups; charts are
animation-disabled Recharts; ranking slices top 8; duplicate detection O(n).
Known debt: ~1.3 MB `primitives` chunk (Recharts in shared chunk) — code-split if
first paint matters.
