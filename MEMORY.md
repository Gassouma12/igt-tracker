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

## open_gaps (priority order)

1. **RLS tightening** — permissive policies allow any authenticated user to
   escalate (`update users set role='admin'`). Mirror rbac.ts as policies before
   real rollout; enforce `status='approved'` server-side. Scoped example in schema.sql.
2. **Owner dashboard steps to go live**: Auth → Email → disable "Confirm email";
   set `VITE_USE_SUPABASE_AUTH=true`; sign up; SQL `update users set role='admin',
   status='approved' where email='…'`; add the 3 Actions secrets for Pages.
3. **Contracts flow**: reaching 'Contract signed' never creates a `contracts` row
   (dateSent/dateSigned/daysUntilSigned demo-only; avgDaysToSign stale for new data).
4. **Receivable due dates** (Roxy): forecast is stage-weighted, not date-scheduled —
   add expectedPaymentDate to opportunities for true per-period credit planning.
5. No delete/edit UI: companies, contacts, opportunities (notes are editable).
6. Approval push: approved user must "Check again" in mock mode (realtime handles it in auth mode).
7. images bucket empty (bundled assets used; upload optional via scripts/upload-images.mjs + service key).
8. Perf polish: 1.3MB shared chunk (Recharts) — code-split if needed.

## environment_quirks

- Preview MCP roots in the sibling Hikma dir; launch.json name "igt" uses the 8.3
  short path. The user's own dev server often holds :5173 — verify via
  tsc/build/audit-tests instead of fighting the port.
- Direct DB host is IPv6-only; use the session pooler
  `aws-0-eu-west-1.pooler.supabase.com:6543`, user `postgres.<ref>`.
- PowerShell 5.1: no `&&`, here-strings need `'@` at column 0; prefer git bash for chains.
- Windows CRLF warnings on commit are noise.
