# iGT Sales Platform — Session Handoff

> Transfer doc for continuing this build in a fresh session. Read this top-to-bottom and
> you have the whole picture: what the app is, every role's feature set, what's done, the
> gotchas that will bite you, and what's left. For deeper code conventions see `README.md`.

---

## 1. What this is

A React + TypeScript CRM + performance-management platform for **AIESEC in Belgium's iGT
(Global Talent sales)** operation. It replaces a 42-tab Excel workbook (`iGT Master Sheet.xlsx`)
— 24 per-member tracking sheets + brittle cross-sheet roll-up dashboards — with a fast,
role-aware web app. **Real spreadsheet data was migrated via a one-time Python ETL** and lives
in `src/data/seed/*.json`.

- **Project root:** `C:\Users\abena\Desktop\AiB IGT Master Tracker` (own git repo, sibling to Hikma)
- **Latest commit:** `5fbbcee` — _"Fixes: meeting-notification parity, goal sync/visibility, view-only pipeline, contacts"_
- **Status:** Feature-complete for all four roles. Mock data layer. No backend yet (Supabase seam in place).

### Run it

```bash
cd "C:\Users\abena\Desktop\AiB IGT Master Tracker"
npm install
npm run dev        # Vite dev server :5173
npm run build      # tsc + vite build  (currently green)
npm run preview    # serve the production build
```

**Preview-MCP quirk:** the Claude Preview tool is rooted in the *Hikma* directory, not here.
To drive this app through it, start via the 8.3 short path (no spaces):
`npm run dev --prefix C:\Users\abena\Desktop\AIBIGT~1`. `vite.config` has `server.fs.strict:false`
for this, and Hikma's `.claude/launch.json` has an **"igt"** config wired up.

### Log in (mock auth — any password)

Login page has 4 quick-sign-in buttons. Seed user ids:

| Button | id | Role | Scope |
| --- | --- | --- | --- |
| Admin · global view | `usr_admin` | `admin` (MCVP) | Everything |
| LCP · LC Ghent | `usr_pavlos` | `lcp` | Whole LC Ghent |
| LCVP · sales team | `usr_tijs` | `lcvp` | Self + own team |
| Member · own pipeline | `usr_kobe` | `member` | Self only |

Session + filters persist to `localStorage` (Zustand). To reset seeded data, clear site storage.

---

## 2. Stack

- **Vite + React 19 + TypeScript**, React Router **v7** (lazy, role-guarded routes)
- **TailwindCSS** dark-first; channel-based RGB CSS vars (`--brand-rgb: …`) mapped via
  `rgb(var(--x-rgb) / <alpha-value>)` so Tailwind opacity modifiers (`bg-brand/10`) work
- **Zustand** for the in-memory DB store, session, filters, focus (all persisted)
- **Radix UI** primitives (Dialog/Select/Tabs) styled with Tailwind
- **Recharts** charts · **Framer Motion** transitions · **lucide-react** icons
  (lucide v1 dropped brand logos → inline LinkedIn SVG in `LinkedInLink.tsx`)
- **TS config:** `erasableSyntaxOnly` (no enums — string-union `as const` arrays),
  `verbatimModuleSyntax` (`import type`), `noUnusedLocals: false`. No `baseUrl` (TS6 deprec) — `paths` only.

---

## 3. Architecture map

```
src/
  main.tsx · App.tsx                 # App.tsx = lazy routes + RBAC guards
  app/nav.ts                         # navFor(role) + homePathFor(role)
  data/
    seed/*.json                      # migrated real data (11 entity files)
    types.ts                         # entities + string-union types (no enums)
    store.ts                         # Zustand DB, seeded from JSON, localStorage-persisted
    repositories.ts                  # generic async CRUD per entity (Supabase-swappable)
    actions.ts                       # domain mutations: write data + audit log + notifications
  lib/
    rbac.ts                          # ALL access rules (see §5)
    metrics.ts                       # pure roll-ups (funnel, kpis, conversions, goals, revenue, reminders, timeline)
    metrics.selfcheck.ts             # asserts roll-ups vs known sheet totals
    dates.ts · format.ts · useSort.ts · cn.ts
  state/  session.ts · filters.ts · focus.ts   # zustand stores
  components/
    ui/        primitives, Table (+SortHeader), Modal, Dropdown, Field, MonthRange,
               StatusBadge, PageHeader, Tabs, LinkedInLink, ProgressRing(in primitives)
    layout/    AppShell, Sidebar, Topbar, guards (RequireAuth/RoleRoute),
               GlobalSearch, NotificationBell
    charts/    Charts.tsx (Recharts wrappers)
  features/
    auth/      Login
    admin/     GlobalDashboard, LCManagement, UserManagement, Analytics, Settings
    lc/        Overview, Pipeline, Team, Goals, Reports  (+ useLC)
    member/    MyPipeline, Companies, Activities, Meetings, Performance,
               OpportunityDialog, CompanyDialog, AddOpportunityDialog  (+ useScopedData)
    shared/    Dashboard, PipelineSummary, GoalEditor, GoalCards
scripts/etl/migrate_xlsx.py          # one-time xlsx → seed JSON
```

**The Supabase-readiness seam:** `repositories.ts` exposes async `list/get/create/update/remove`
per entity, today reading/writing the local store. Migrating = swap each body for
`supabase.from(key)...`. **No UI or metrics changes needed.** `actions.ts` is the "smart" layer
on top (keeps derived fields consistent + writes audit log + fires notifications).

---

## 4. Data model

Flat Excel outreach rows were normalized into:
**Company → Contact → Opportunity → (Activities · Meetings · Contract)**.

Entities (`src/data/types.ts`), all id-keyed, FKs are plain id strings:

- **users** — role (`admin|lcp|lcvp|member`), `lcId`, `teamLeadId`, `position`, `active`
- **localCommittees** — `lcpId`, `lcvpIds[]`, country
- **companies** — de-duplicated across members (Excel repeated names per tab)
- **contacts** — `companyId`, name/role/email/phone/linkedin (**multiple per company**)
- **opportunities** — `ownerId`, `lcId`, `status` (8-stage funnel), `value` (EUR),
  `revenueReceived`, `nextAction`/`nextActionDate`, `lastActivityAt`, timestamps
- **activities** — one row per touch: `type` (LinkedIn/Email/Cold call/Follow-up/Meeting),
  `phase` (first/follow-up/meeting), `outcome` (positive/neutral/no-response), date, notes
- **meetings** — numbered per opportunity, outcome, nextAction
- **contracts** — dateSent, dateSigned, daysUntilSigned
- **goals** — `scope` (member/lc/global), `ownerId`, `metric` (outreaches/meetings/contracts/revenue),
  `period` (`'2026-S1'`), `planned`
- **activityLog** — audit trail (actor, entity, action, from→to, at)
- **notifications** — **stored & targeted** (kind: `meeting|contract|goal`; `opportunityId` is
  `null` for goal notifications). Distinct from the **derived `reminders()`** in metrics.

**Opportunity stages:** `Prospect → Contacted → Follow-up → Meeting scheduled → Negotiation →
Contract sent → Contract signed` (+ `Lost`). `bump()` in actions.ts never downgrades.

---

## 5. RBAC — the rules (`src/lib/rbac.ts`)

This is the single source of truth for access. When this moves to Supabase, these become RLS policies.

| Helper | Rule |
| --- | --- |
| `visibleOwnerIds` | admin → all · lcp → whole LC · lcvp → self + team + LC · member → self |
| `canEditOwned` | **owner + admin only.** LCP/LCVP **view** members' pipelines, cannot edit |
| `scopeOpportunities` | filters opps by `visibleOwnerIds` |
| `supervisorsOf` | higher-ranked people in same LC + **every** admin (MCVP) — notification recipients |
| `canSetGoalFor` | lcvp → members · lcp → lcvps · admin(MCVP) → lcvps (all within LC) |
| `goalContributorIds` | **whose numbers roll into a goal:** member→self · **lcvp→self+team** · lcp→whole LC · admin→everyone |
| `canViewGlobalDashboard` | admin only |

Rank order: `member(0) < lcvp(1) < lcp(2) < admin(3)`.

---

## 6. Features per role

### Member (e.g. Kobe) — `/me/*`
- **My Pipeline** — kanban board / table / summary views. Drag cards between stages (highlights
  drop column, lifts card). **Stackable stage filter chips** (multi-select). Month-range filter.
  Notification click jumps here → table → scrolls to + pulses the row.
- **Companies** — sortable table → opens **CompanyDialog** (company info + **multiple contacts**
  with name/role/email/phone/LinkedIn glyph + the company's visible opportunities).
- **Activities** — sortable timeline table.
- **Meetings** — sortable table.
- **Performance** — goal-achievement **progress-ring cards** (sees own goals set by their VP),
  funnel + revenue, month-range filter.
- **OpportunityDialog** — single **"Record an interaction"** segmented control
  (LinkedIn / Email / Call / Meeting); Meeting → `addMeeting`, else → `logActivity`. Stage
  dropdown, deal value, "Revenue received" toggle, schedule next step, activity timeline.

### LCVP (e.g. Tijs) — `/lc/*` **and** `/me/*`
- All **LC** pages: Overview, Pipeline (**view-only** on members' leads — "View only" pill, no
  stage dropdown, no edit, can't drag), Team, **Goals** (set member goals via `GoalEditor`), Reports (CSV).
- Full **member workspace** for their own pipeline (can edit own leads).
- **Performance**: per-member filter; **their goal = own numbers + team's** (`goalContributorIds`).
- Gets a notification when a member schedules a meeting / signs a contract.

### LCP (e.g. Pavlos) — `/lc/*` and `/me/*`
- Same LC pages as LCVP but scoped to the **whole LC** (view-only on others' pipelines).
- **Goals**: sets **LCVPs'** goals. Performance goal aggregates the whole LC.

### Admin / MCVP (`usr_admin`) — `/admin/*` + `/me/performance`
- **Global Dashboard** — KPIs, funnel, conversions, LC + member rankings, timeline, goals.
- **LC Management** (set LCVP goals), **User Management** (inline edit), **Analytics**, **Settings**.
- **Edits everything** (`canEditOwned` returns true). Receives every win notification.

---

## 7. Conventions & gotchas (these will bite)

- **Zustand selectors must return stable refs.** Never `.filter()`/`.map()` inside a selector
  (new array each render → "getSnapshot should be cached" infinite loop). Select the whole
  array, derive in `useMemo`. See `OpportunityDialog.tsx` top comment.
- **Modal centering:** use the **opacity-only** `animate-fade-in` keyframe on Radix Dialog
  content, **not** `animate-fade-up` — a transform animation clobbers `-translate-x/y-1/2`.
- **Notification parity:** wins fire from **`actions.ts`** — `advanceStage` notifies on reaching
  *Meeting scheduled* AND *Contract signed*, so the kanban drag and the dialog dropdown behave
  identically to logging a meeting. If you add a new "win" path, route it through `notify()`.
- **Tailwind opacity modifiers** only work because the palette is channel-based RGB vars. Don't
  reintroduce plain `var(--x)` colors.
- React 19 `useRef` needs an initial value: `useRef<T | undefined>(undefined)`.
- **No enums** (erasableSyntaxOnly) — use the `as const` string-union arrays in `types.ts`.

---

## 8. What's done (all verified, committed)

All 21 tracked tasks complete. Highlights from the last two batches:
- ✅ Meeting-notification sync (kanban ↔ dialog parity via `advanceStage`)
- ✅ Goals: visibility for member/LCVP, goal-set notification, **LCVP goal = own + team**
- ✅ View-only pipeline for LCP/LCVP; MCVP edits all
- ✅ Simplified "Record an interaction" segmented control
- ✅ Performance "Goals achieved" redesigned as progress-ring cards
- ✅ Stackable stage filter chips in My Pipeline
- ✅ **Multiple contacts per company** + LinkedIn icons (CompanyDialog)
- ✅ Styled dropdowns, modal-centering fix, kanban drag polish
- ✅ Sortable/stackable table columns across pipeline/companies/activities/meetings
- ✅ Month-range filters + numbers/charts views; role-based Performance filters
- ✅ Revenue goals (receivable + received) + goal-setting hierarchy
- ✅ Targeted notifications: supervisor routing, read/unread, click-to-locate + row pulse

Build is green; no console errors on the full role tour.

---

## 9. What's next (not started)

1. **Supabase migration** — the big one. Swap repository bodies for `supabase.from(...)`,
   wire real auth (replace mock `login(userId)`), Postgres tables mirror `types.ts` 1:1, turn
   `rbac.ts` rules into RLS policies, storage for any file uploads. **No UI/metrics rewrite.**
2. **Reference content** from the Excel (not yet surfaced): Value Proposition, Cold Outreach
   Tips, NEC resource hub, IR/LC directory — render as static pages.
3. **Notification delivery** beyond in-app (email/push) — currently stored + shown in the bell only.
4. **Real goal periods** — `PERIOD` is hardcoded `'2026-S1'` in `actions.ts`. Make it selectable.
5. Possible polish: contract `dateSent/dateSigned` editing UI, bulk import, per-LC theming.

---

## 10. Verification notes / tooling limits

- `npm run build` passes (tsc + vite). `metrics.selfcheck.ts` asserts roll-ups vs sheet totals.
- **Radix Select** listboxes and **native HTML5 drag-drop** can't be driven by the preview test
  tooling (synthetic clicks/drag don't open Radix portals / trigger DnD). Those paths were
  verified by **code parity** + data-layer assertions, not synthetic UI events.
- Preview **screenshots time out on chart-heavy pages** (environmental) — verify those via DOM
  snapshot / `preview_eval` instead.
- Synthetic blur doesn't trigger React `onBlur` — dispatch `FocusEvent('focusout',{bubbles:true})`.
