# MEMORY — Project State & Decision Log

> Compressed context for continuing work in a fresh session. Read with CLAUDE.md.
> Supersedes HANDOFF.md (deleted). Last audit: 2026-07-06.

## state_snapshot

- Repo: `C:\Users\abena\Desktop\AiB IGT Master Tracker` → github.com/Gassouma12/igt-tracker (main)
- Live: https://gassouma12.github.io/igt-tracker/ — **demo mode** (no Supabase secrets in CI yet; env passthrough is wired in deploy.yml, secrets missing)
- Build: tsc + vite green · `npx tsx scripts/audit-tests.mts` → 30/30
- Supabase project `sayuohpchlpmykdvwtdo` (**eu-west-1**): schema applied, org
  seeded (3 LCs, 22 users, zero sales rows — intentional), realtime publication =
  all 11 tables (users was missing; fixed 2026-07-06), auth.users = 0, RLS =
  permissive authenticated-ALL. DB password known to owner only — NOT in repo.
- `.env` local: URL + publishable key set, `VITE_USE_SUPABASE_AUTH=false`
- App state: mock data + demo sign-in until auth flag flips.

## decisions (why things are the way they are)

- Store-first writes + fire-and-forget mirror → instant UI, backend optional.
- Hydrate skips empty tables → linked-but-unseeded DB keeps demo data.
- Outreach ≡ distinct companies (business rule from user); raw touches only for channel mix.
- Goals cadence-keyed (weekly/monthly/semester) so periods never collide;
  "done" windows to the CURRENT period, ignoring the page's month filter.
- LCP/LCVP are view-only on members' leads; own pipelines live at /me (nav "My Pipeline").
- Seed = org only (user removed sales data from gen-seed-sql.mjs deliberately).
- Auth flag ships OFF so the app can't brick before seeding/bootstrap.
- Duplicate-partner block is client-side by normalized name; server unique index
  deliberately deferred (LCs may legitimately share a company record later).
- Weighted forecast probabilities: Contacted .05 / Follow-up .10 / Meeting .30 /
  Negotiation .50 / Contract sent .80 (`CLOSE_PROB` in metrics.ts) — tune with Roxy.

## fixed_this_audit (2026-07-06)

- **TZ bug**: `dates.ts iso()` used toISOString → CET weekly/monthly goal windows
  started Sunday / ended a day early. Now local-component formatting; test-guarded.
- **users table missing from realtime publication** (setup runner dropped a
  statement preceded by comments). Publication fixed live; runner fixed.
- deploy.yml now passes VITE_SUPABASE_* from Actions secrets (empty ⇒ demo).

## closed_2026-07-06 (production hardening pass)

- RLS tightened + applied live (`supabase/rls.sql`, 38 policies; permissive block
  removed from schema.sql) — verified by `scripts/qa-live.mjs`: **27/27** live
  checks incl. escalation attempts, owner-only writes, cascade deletes, cleanup.
- Actions secrets set via API (VITE_SUPABASE_URL / ANON_KEY / USE_SUPABASE_AUTH=true)
  → Pages builds bake real env. `.env` local auth flag → true.
- Features: auto contract rows on Contract sent/signed (real daysUntilSigned);
  `expectedPaymentDate` (+ live DB migration) with "Payment expected" field and
  receivables-by-month schedule on Performance; delete opportunity (danger zone,
  local child cascade) + delete contact; approval notification; hydrate re-runs
  on SIGNED_IN (startup hydrate is anonymous under RLS).

## open_gaps (priority order)

1. **Admin bootstrap incomplete**: auth.users is EMPTY — the owner's "admin set"
   hit the seeded demo row. They must sign up in the app (auth mode on), then:
   `SUPABASE_DB_URL=... node scripts/promote-admin.mjs <their-email>`.
2. images bucket empty (bundled assets used; upload optional via scripts/upload-images.mjs + service key).
3. Company delete/edit UI (admin-only concern; contacts + opportunities covered).
4. Perf polish: 1.3MB shared chunk (Recharts) — code-split if needed.
5. RLS ceilings accepted: org-wide SELECT for approved users; LC leads can update
   any column on their LC's member rows; see CLAUDE.md security_state.

## environment_quirks

- Preview MCP roots in the sibling Hikma dir; launch.json name "igt" uses the 8.3
  short path. The user's own dev server often holds :5173 — verify via
  tsc/build/audit-tests instead of fighting the port.
- Direct DB host is IPv6-only; use the session pooler
  `aws-0-eu-west-1.pooler.supabase.com:6543`, user `postgres.<ref>`.
- PowerShell 5.1: no `&&`, here-strings need `'@` at column 0; prefer git bash for chains.
- Windows CRLF warnings on commit are noise.
