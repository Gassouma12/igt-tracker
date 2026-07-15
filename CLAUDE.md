# iGT Sales Platform — Claude Code Rules

React CRM + performance platform for AIESEC in Belgium's iGT sales, replacing a
42-tab Excel workbook. See `ARCHITECTURE.md` (system design), `FEATURES.md`
(per-role inventory), `MEMORY.md` (current state + decision log).

## commands

```bash
npm run dev        # Vite :5173
npm run build      # tsc -b && vite build — MUST stay green
npm run lint       # oxlint
npx tsx scripts/audit-tests.mts   # 30 edge-case checks on pure layers — run after touching src/lib/*
node scripts/gen-seed-sql.mjs     # regenerate supabase/seed.sql (org only)
SUPABASE_DB_URL="<session-pooler URI>" node scripts/setup-supabase.mjs  # idempotent schema+seed+realtime
```

## build_constraints

- TS: `erasableSyntaxOnly` → **no enums** (use `as const` string-union arrays in
  `src/data/types.ts`); `verbatimModuleSyntax` → `import type`; no `baseUrl`, `@/*` via paths.
- React 19: `useRef<T | undefined>(undefined)` — initial value required.
- Vite `base: '/igt-tracker/'` + `BrowserRouter basename={import.meta.env.BASE_URL}` —
  never hardcode absolute URLs; favicon is set in `main.tsx` from the bundled asset.
- Tailwind palette is channel-RGB vars (`rgb(var(--x-rgb) / <alpha-value>)`) so
  opacity modifiers work — never reintroduce plain `var(--x)` colors.

## state_rules

- **Zustand selectors must return stable refs.** Never `.filter()/.map()` inside a
  selector ("getSnapshot should be cached" infinite loop). Select whole arrays,
  derive in `useMemo`.
- The store (`src/data/store.ts`) is the reactive source of truth, persisted to
  localStorage (`igt.db.v1`); session in `igt.session`.
- All mutations go through `src/data/actions.ts` (writes + audit log + notifications
  + derived-field consistency) — never call `repo.*` directly from components.

## data_layer

- `repositories.ts`: async CRUD per entity; local store first, then **mirror to
  Supabase when configured** (errors logged, never thrown). `hydrateFromSupabase()`
  on startup keeps bundled demo data for any table that is empty in the DB.
- `realtime.ts`: subscribes to every table, patches the store (INSERT dedup by id).
- Supabase gating: `isSupabaseConfigured` (env URL+key), `useSupabaseAuth`
  (`VITE_USE_SUPABASE_AUTH === 'true'`). With both off the app is pure mock.
- Postgres columns are **quoted camelCase**, mapping 1:1 onto the TS entities —
  changing a field name means changing `supabase/schema.sql` too.

## domain_rules

- Funnel: Prospect → Contacted → Follow-up → Meeting scheduled → Negotiation →
  Contract sent → Contract signed (+ Lost). `bump()` never downgrades.
- **Outreach = distinct companies contacted** (`outreachCount`), not raw touches;
  repeat touches are follow-ups. Raw volume only for channel-mix (`totalOutreaches`).
- Meetings **had** = `meetings` rows; **scheduled** = opps at 'Meeting scheduled'
  with no meeting row (`meetingStats`).
- Goals are cadence-keyed (weekly/monthly/semester × period string) — the
  (owner, metric, cadence, period) tuple is unique; "done" is windowed to the
  cadence's CURRENT period via `periodRange` (LOCAL dates — see date_gotchas).
- Notifications (stored, targeted): wins route through `notify()` →
  `supervisorsOf` (LC chain above actor + every admin). New "win" paths MUST go
  through `advanceStage`/`addMeeting`/`setRevenueReceived` so kanban and dialog stay in parity.
- Duplicate partners: `normCompany` (drops legal suffixes) powers both the
  passive `DuplicatesPanel` and the hard block in `AddOpportunityDialog`.

## rbac (mirror of future RLS — single source: src/lib/rbac.ts)

- visibility: member=self · lcvp=self+team+LC · lcp=LC · admin=all
- edit: **owner + admin only** (`canEditOwned`) — LCP/LCVP view-only on others
- goals: lcvp→members, lcp→lcvps, admin→lcvps (same LC); contributors: lcvp
  aggregates self+team, lcp whole LC
- assignment: `canAssignMembers` = lcp/lcvp/admin (Team page dropdown)
- Client-side only today — server RLS is permissive authenticated-all (see security_state)

## ui_conventions

- Radix Dialog content: **opacity-only** `animate-fade-in` (a transform animation
  clobbers `-translate-x/y-1/2` centering).
- Toggling forms that swap controlled/uncontrolled inputs need distinct `key`s
  (Login signin/signup regression).
- Tables: `useSort` (stackable) + `usePaged(25)` + `<Pagination>`; page headers via
  `PageHeader`; brand mark `BrandMark` (gem.png), credits `Credits` — both in `ui/Brand.tsx`.
- lucide v1 has no brand icons — LinkedIn is the inline SVG in `ui/LinkedInLink.tsx`.

## date_gotchas

- Never `toISOString().slice(0,10)` for LOCAL calendar math — CET is ahead of UTC
  and it shifts a day (bug fixed in `dates.ts iso()`; audit test guards it).
- ISO weeks via `isoWeek` (UTC-internal, year-boundary safe — tested).

## security_state (read before any auth/RLS work)

- RLS = permissive starter (`*_auth_all`, ALL for authenticated): any logged-in
  user can write anything incl. `users.role` — **privilege escalation is open by
  design until policies are tightened** to mirror rbac.ts. Do not ship real
  multi-user auth without that.
- DB password is NOT in the repo; `.env` (URL + publishable key) is gitignored.
- Pending-account gate is client-side (`RequireAuth`); enforce in RLS when tightening.

## verification

- Preview MCP is rooted in the Hikma dir; dev server via launch.json name "igt"
  (8.3 short path). Port 5173 may be held by the user's own dev server — prefer
  `tsc` + `vite build` + `audit-tests.mts` when it is.
- Radix Select listboxes and HTML5 drag-drop cannot be driven synthetically —
  verify those by code parity + data-layer assertions.
- Screenshots time out on chart-heavy pages — verify via DOM eval instead.

## deployment

- GitHub Pages via `peaceiris/actions-gh-pages` on push to main → gh-pages branch
  → https://gassouma12.github.io/igt-tracker/ . SPA deep links use the 404.html
  sessionStorage trick (HTTP status is 404 but redirect works).
- Supabase env comes from repo Actions secrets (VITE_SUPABASE_URL /
  VITE_SUPABASE_ANON_KEY / VITE_USE_SUPABASE_AUTH); until set, the live site is demo-mode.
