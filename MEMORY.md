# MEMORY — Project State & Decision Log

> Compressed context for continuing work in a fresh session. Read with CLAUDE.md.
> Supersedes HANDOFF.md (deleted). Last audit: 2026-07-06.

## state_snapshot (updated 2026-08-03 — LIVE)

- **UX/BA pass 2026-08-03**: one LCVP per LC (demo generator reuses an existing
  real LCP/LCVP instead of adding a second); member assignment is LCVP-only and
  targets team leaders (`canAssignMembers` = lcvp); Goals page has an S1/S2
  toggle (done windowed to the semester); new app-styled `DateRangePicker` (dual
  calendar + shortcuts) replaced MonthRange on My Pipeline / LC Pipeline /
  Performance / Reports (`inRange` day filter); Activities+Meetings merged into
  one **Interactions** page (`/me/interactions`). Deleted MonthRange/Activities/
  Meetings. Date filters: `filters.from/to` are now DAY strings.
- BA backlog (documented, not yet done — needs sign-off): pipeline appears on
  "My Pipeline" + "LC Pipeline" (could unify with a scope toggle); Overview vs
  Reports vs Performance share funnel/conversion charts (could differentiate);
  admin Global Dashboard vs Analytics overlap.

## state_snapshot (2026-08-02)

- **team_leader role added** (2026-08-02): hierarchy admin › lcp › lcvp ›
  team_leader › member; linked via `teamLeadId`. rbac.ts + DB role CHECK +
  signup policy + goals RLS (admin→lcvp, lcvp→tl, tl→member; lcp view-only) all
  updated & verified live. Goals page rebuilt around `manageableUsers` + exposed
  to admin/team_leader. Build 32/32 audit, 27/27 live QA.
- **Test-login accounts** (real auth, password `igtdemo123`): admin/lcp/lcvp/
  team_leader/member `*.test@igt.aiesec.be`, wired into a hierarchy in LC Ghent.
  One-click buttons appear on `/login?demo` only. Created/refreshed via
  `scripts/create-test-users.mjs`. **Remove before wide release** (known creds).
- Fixes 2026-08-02: first-login race (guard spinner while hydrating), meetings
  scheduled vs had is date-aware, add-opportunity duplicate is a soft warning
  (member·LC·email, can proceed), activity log trimmed to key events, analytics
  duplicate panel clickable + emails, old "Reset data" button removed, login copy
  refreshed, signup drops position + adds Team Leader.

## state_snapshot (2026-07-29)

- Repo: `C:\Users\abena\Desktop\AiB IGT Master Tracker` → github.com/Gassouma12/igt-tracker (main)
- Live: https://gassouma12.github.io/igt-tracker/ — **PRODUCTION** (real Supabase
  auth; secrets set in CI; deploy verified serving new bundle).
- Build: tsc + vite green · `npx tsx scripts/audit-tests.mts` → 31/31 ·
  `scripts/qa-live.mjs` → 27/27 (updated for clean slate).
- Supabase project `sayuohpchlpmykdvwtdo` (**eu-west-1**): scoped RLS live (38
  policies), realtime on all 11 tables, `expectedPaymentDate` migration, plus
  `notify_admins_on_signup` trigger (supabase/triggers.sql). DB password owner-only.
- **Clean slate done**: the 22 demo users are DELETED. Only real account =
  `kacem@aiesec.be` (admin/approved, LC=`lc_mc` "MC", pos "MCVP BD&EwA"). LCs =
  Antwerp/Ghent/Leuven + MC. All sales tables empty (real data starts here).
- `.env` local + CI: URL + publishable key + `VITE_USE_SUPABASE_AUTH=true`.
- App: real auth. hydrate adopts the DB as source of truth in real-auth mode
  (empty table => empty store), so no bundled demo leaks into production.
- Error boundary + write-failure toasts (revert optimistic update) shipped.

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

1. **Password reset is manual** — no self-service flow (deliberate). Login shows
   "forgot password → email kacem@aiesec.be"; admin resets from Supabase dash
   (Auth → Users → … → Send recovery / set password). Self-service reset would
   need resetPasswordForEmail + a recovery screen + email templates.
2. **Only 3+MC LCs** — Antwerp/Ghent/Leuven + MC. Add the rest of AiB's LCs when
   known (no in-app "create LC" UI yet → insert via SQL or add one).
3. images bucket empty (bundled assets used; upload optional via scripts/upload-images.mjs + service key).
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
