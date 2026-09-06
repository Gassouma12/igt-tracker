# Production-readiness pass — 2026-09-06

Branch: `feature/production-hardening-2026-09`. This documents what changed, the
data-management assessment, the security posture, and the **steps you must run**
against the live Supabase project (they need the service-role key / DB owner
access, which is not in the repo).

---

## 1. What shipped in code (deployable)

| Area | Change | Files |
|---|---|---|
| **Lead contacts** | Edit an existing contact, add another, and switch a lead's primary contact — from the company drawer *and* directly on the lead. | `member/CompanyDialog.tsx`, `member/OpportunityDialog.tsx`, `data/actions.ts` (`updateContact`, `setOpportunityContact`) |
| **Signup spinner** | Fixed the freeze on first account creation: the `SIGNED_IN` hydrate raced the profile insert and wiped the local row. Hydrate now preserves the signed-in user's own row. | `data/repositories.ts` |
| **Re-registration** | A user whose account was deleted can sign up again and admins get the approval request. Client signs the returning user in and calls a server-side reclaim RPC; degrades to today's behaviour until the migration is applied. | `data/actions.ts` (`signUp`), `supabase/migrations/request_account.sql` |
| **LCVP team view** | Team page grouped by team leader (leadership · one card per team + totals · unassigned). | `lc/Team.tsx` |
| **Team leader scope** | Verified: team leaders already see only their own team (via `visibleOwnerIds`). Renamed their tab + page to **Team Pipeline** (LCP/LCVP keep **LC Pipeline**). | `app/nav.ts`, `lc/Pipeline.tsx` |
| **Reminders** | Moved to their own icon with its own badge + dropdown, separate from notifications. | `layout/RemindersBell.tsx`, `layout/NotificationBell.tsx`, `layout/Topbar.tsx` |
| **Delete notifications** | Bin on each notification (deletes for the account + from the DB) plus "Clear all". | `layout/NotificationBell.tsx`, `data/actions.ts` (`deleteNotification`, `clearAllNotifications`) |
| **Production login** | Removed the one-click demo accounts from the login page. | `auth/Login.tsx` |
| **Security (code)** | Action-layer permission guards, MCVP protection mirrored in `updateUser`, client auth-attempt throttle. | `data/actions.ts`, `lib/rateLimit.ts`, `auth/Login.tsx` |
| **Data management (code)** | Stop persisting the audit log to localStorage; hydrate now paginates (was silently capped at 1000 rows). | `data/store.ts`, `data/repositories.ts` |

Verification: `npm run build` (tsc + vite) green · `scripts/audit-tests.mts` 33/33 ·
manual browser QA of all new UI in mock mode (contact edit/add, both bells, delete
bin, team grouping, login).

---

## 2. Data-management assessment (DB bloat)

**Current shape.** The whole DB is loaded into the client store and mirrored to
`localStorage` on every write; Postgres is the source of truth in production.

**Risks found & status**

1. **`localStorage` re-serialized on every mutation, growing without bound.**
   The highest-churn table is `activity_log` (a row per mutation) — admin-only and
   always re-fetched. **Fixed:** it is no longer persisted locally (`store.ts`).
   Over-quota was previously swallowed silently (writes just stopped persisting).
2. **Hydrate truncated at 1000 rows.** `select('*')` hits PostgREST's default cap,
   so once `activities`/`opportunities` pass 1000 rows the app silently loaded a
   partial dataset. **Fixed:** hydrate pages through with `.range()`.
3. **`activity_log` and `notifications` grow forever in the DB.** No retention.
   **Provided:** `supabase/migrations/perf_indexes_and_retention.sql` — a
   `prune_old_data()` function (12-month log / 90-day read-notifications) you can
   run manually or schedule via `pg_cron`, plus an optional trigger that caps
   notifications at the newest 200 per recipient.
4. **Missing indexes** on some owner-scoped columns. **Provided** in the same
   migration (`activities.ownerId`, `meetings.ownerId`, `goals.ownerId`,
   `contracts.opportunityId`, `activity_log.at/actorId`, `notifications.at`).
5. **Everything is loaded client-side + realtime streams every table to every
   client.** Fine at current scale (a few LCs). **Recommendation for later:** load
   `opportunities` scoped and lazy-load `activities` per lead; drop `activity_log`
   from the realtime publication (nothing subscribes to it meaningfully).

**Bottom line:** the two real scaling bugs (silent 1000-row cap, unbounded local
persistence) are fixed in code. Apply the retention/index migration for the DB
side; the client-side-scoping items are future work, not blockers.

---

## 3. Security posture

- **Auth on every endpoint.** All data access is Supabase PostgREST with RLS
  enabled on all 11 tables and an `is_approved()` gate. The only pre-auth read is
  `local_committees` (the signup form lists LCs). No unauthenticated data path.
- **Permissions verified before actions.** `src/lib/rbac.ts` (client) mirrors
  `supabase/rls.sql` (server, the real enforcer). Added client action-layer guards
  as defense-in-depth: owner-or-admin on lead writes, `canSetGoalFor` on goals,
  admin-only on approvals, and **MCVP protection** (`kacem@aiesec.be` role/active
  can't be changed) now mirrored in `updateUser`.
- **No API keys in the frontend.** Only the *publishable/anon* key ships to the
  browser — that is by design and safe because RLS enforces access. Verified there
  is **no** `service_role` key anywhere in the repo or bundle; it lives only in
  owner-run scripts via env vars, and `.env` is gitignored.
- **Rate limiting.** Supabase Auth enforces sign-in/sign-up rate limits
  server-side. Added a client-side attempt throttle (`lib/rateLimit.ts`) for UX +
  defense-in-depth. For stronger app-wide limits, an edge function/gateway is the
  next step (infra-level, not shipped here).
- **Error handling.** Writes never throw (optimistic update + rollback + toast on
  failure); a root `ErrorBoundary`; friendly signup/sign-in errors including the
  re-registration path.

**Recommended follow-ups (server-side, owner):** enforce MCVP protection with an
RLS trigger (currently client-mirrored); apply `request_account.sql`; consider
column-level control for LC-lead member updates (documented ceiling).

---

## 4. Steps you need to run (service-role / DB owner)

These need credentials that aren't in the repo. Get the **service_role** key from
Supabase → Project Settings → API → `service_role`.

### 4a. Apply the SQL migrations (SQL editor)
Run each once, in order:
1. `supabase/migrations/request_account.sql` — reliable re-registration + admin notify.
2. `supabase/migrations/perf_indexes_and_retention.sql` — indexes + retention.
3. (already noted in MEMORY) `supabase/migrations/add_company_tax_number.sql` if not yet applied.

### 4b. Remove demo/test users + their data — **preview first**
```bash
# preview (nothing is deleted) — review the printed list:
SUPABASE_URL="<your url>" SUPABASE_SERVICE_ROLE_KEY="<service_role>" node scripts/cleanup-demo-data.mjs

# once the list looks right, actually delete:
SUPABASE_URL="<your url>" SUPABASE_SERVICE_ROLE_KEY="<service_role>" node scripts/cleanup-demo-data.mjs --apply

# optional: also remove companies with no opportunities left behind:
SUPABASE_URL="<your url>" SUPABASE_SERVICE_ROLE_KEY="<service_role>" node scripts/cleanup-demo-data.mjs --apply --prune-companies
```
`kacem@aiesec.be` and everything they own is hard-excluded. The script targets
seed ids (`usr_*`), `*.test@…`, `mock`/`demo` emails, and `@aib.org`.

### 4c. Go live
Merge this branch to `main` → GitHub Actions builds and deploys to
https://gassouma12.github.io/igt-tracker/ automatically.
