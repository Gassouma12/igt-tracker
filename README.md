# iGT Sales Management Platform

A role-aware CRM + performance-management web app that replaces the **iGT Master
Sheet.xlsx** spreadsheet for AIESEC in Belgium. It manages the full sales motion —
companies, contacts, outreach, meetings, contracts and goals — across multiple Local
Committees, preserving every capability of the spreadsheet while making it fast,
scalable and ready for a Supabase backend.

> Beyond a spreadsheet, towards a pipeline you can actually run.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # preview the production build
```

**Demo logins** (mock auth — any password works, or use the one-click quick sign-in):

| Role   | Email               | Sees                                   |
| ------ | ------------------- | -------------------------------------- |
| Admin  | `admin@aib.org`     | Global dashboard, all LCs              |
| LCP    | `pavlos@aiesec.be`  | LC Ghent (president)                   |
| LCVP   | `tijs@aiesec.be`    | LC Ghent sales team                    |
| Member | `kobe@aiesec.be`    | Own pipeline only                      |

## Stack

React 19 · TypeScript · Vite · TailwindCSS (dark-first) · React Router · Zustand ·
Recharts · Radix UI · Framer Motion · lucide-react.

## Architecture

```
src/
  data/
    seed/*.json        # migrated spreadsheet data (output of the ETL)
    types.ts           # entity types + enums
    store.ts           # in-memory store, seeded from JSON, persisted to localStorage
    repositories.ts    # per-entity async CRUD  ← swap bodies for Supabase later
    actions.ts         # domain mutations (log activity, advance stage, …) + audit trail
  lib/
    metrics.ts         # pure roll-ups (funnel, conversion, rankings, goals, timeline)
    rbac.ts            # can*/scope* — becomes Supabase row-level-security policies
    format.ts · cn.ts
  state/               # zustand: session (auth) + filters
  components/ ui · charts · layout
  features/ auth · admin · lc · member
scripts/etl/migrate_xlsx.py   # one-time spreadsheet → seed JSON
```

**Data model** (normalized — the spreadsheet's flat rows become real entities):
`Company → Contact → Opportunity → (Activities · Meetings · Contract)`, plus
`User`, `LocalCommittee`, `Goal`, and an `activityLog` audit trail.

### Supabase-readiness

The app never touches the data directly — it goes through `repositories.ts`, whose
functions are already `async` with the right signatures. Migrating means:

1. Create tables matching `types.ts`.
2. Replace each repository body with `supabase.from(...)` calls.
3. Swap mock auth in `state/session.ts` for `supabase.auth`.
4. Turn `rbac.ts` rules into RLS policies.

No UI, metrics or feature code changes.

## The ETL

`scripts/etl/migrate_xlsx.py` parses the 24 per-member tracking sheets and normalizes
them, cleaning the spreadsheet's mess along the way: drops the `1899` epoch null-dates,
fixes encoding, de-duplicates company names, computes month/week from dates, and derives
each opportunity's pipeline stage from its funnel state.

```bash
pip install openpyxl
IGT_XLSX="/path/to/iGT Master Sheet.xlsx" python scripts/etl/migrate_xlsx.py
```

Re-run anytime to regenerate `src/data/seed/*.json` (deterministic ids).
Current seed: **1,965 opportunities · 1,363 companies · 1,763 contacts · 24 members ·
3 LCs**, reconciled against the source (e.g. Tijs's 626 rows, 11 signed contracts).
A runnable metrics self-check (`src/lib/metrics.selfcheck.ts`) asserts the roll-ups
match these facts and logs the result in dev.

## What's built

- **Auth + RBAC** — mock login, role-based routing/guards, data scoping (member → own,
  lcvp → team, lcp → LC, admin → everything).
- **Admin** — Global Dashboard (KPIs, funnel, conversion, LC & member rankings, timeline,
  goals, LC filter); **LC Management** (per-LC stats, leadership, members); **User
  Management** (inline role / LC / active editing, all audited); **Analytics** (LC
  comparison, channel mix, trend); **Settings** (data summary, reset-to-seed, audit log).
- **LC (LCP / LCVP)** — Overview dashboard, Pipeline (filterable by member/stage/company),
  Team (per-member performance), Goals (LC + per-member progress), Reports (summary +
  **CSV export**).
- **Member Workspace** — pipeline (drag-and-drop kanban + table), companies, activity
  timeline, meetings, personal performance; add company/contact/opportunity, log
  outreach, advance stage, schedule follow-ups, log meetings — all writing through the
  repositories and recording an audit trail.
- **Global search** (scoped) and **derived notifications** (overdue follow-ups, upcoming
  meetings, inactive opportunities).

Every page across all four roles is live (no stubs remain).

## Roadmap (next passes)

- Supabase (DB / auth / storage) migration — the repository seam is in place.
- Surfaced notifications inbox and reference content (value proposition, outreach tips).
- Richer editing (edit company/contact details, manage LC goals in-app).

> Notes: data is currently bundled (seed JSON) and persisted to `localStorage`; member →
> LC assignment and goal targets are documented migration assumptions, editable once the
> management UIs land.
