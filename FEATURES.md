# Feature Inventory

Login: quick sign-ins (mock mode) — Admin `usr_admin` · LCP `usr_pavlos` (Ghent) ·
LCVP `usr_tijs` · Member `usr_kobe`. Sign-up: name/email/phone/position/LC/role
(+password in auth mode) → pending screen (contact kacem@aiesec.be) → admin approval.

## Member — /me/*
- **My Pipeline** (`MyPipeline.tsx`): kanban (drag w/ drop-target highlight; only
  own cards draggable) · table (stackable sort, stackable stage chips, pagination)
  · summary charts. Month-range filter. Notification click → row scroll + pulse.
- **New opportunity** (`AddOpportunityDialog`): company + N contacts
  (name/position/phone/email/linkedin, add-another). **Blocks duplicate partners**
  with an alert naming who works it (member + LC).
- **Lead detail** (`OpportunityDialog`): stage dropdown (auto-notifies supervisors
  on Meeting scheduled / Contract signed), deal value, revenue-received toggle
  (notifies supervisors w/ amount+partner), single "Record an interaction" control
  (LinkedIn/Email/Call/Meeting + notes incl. meeting notes), schedule next step,
  activity timeline, company **Notes** + **History** buttons.
- **Companies** (`Companies.tsx`): sortable/paginated, duplicates panel,
  **Export contacts** CSV, CompanyDialog (multi-contact + LinkedIn glyphs, add contact).
- **Activities / Meetings**: sortable, paginated, row → lead detail.
- **Performance** (`Performance.tsx`): KPI cards; goal rings with
  weekly/monthly/semester cadence toggle (done windowed to current period);
  funnel; **Credit & revenue** (received / receivable / expected pipeline /
  weighted forecast + received-by-month); **stage conversion** (adjacent bars +
  milestone chips); activity-over-time with revenue axis.

## LCVP / LCP — /lc/* (+ full /me/* workspace of their own)
- **Overview**: clickable **Meetings had / scheduled** cards → drill-down modal;
  meeting rows → company data modal; full shared Dashboard.
- **LC Pipeline**: whole-LC table (owner/stage/month filters, pagination) —
  **view-only** on others' leads (View-only pill, no edit controls, no drag).
- **Team**: ranking chart, stats incl. follow-ups; row → **view-only kanban** of
  that member; **Assigned to** dropdown (LCP/LCVP assign members to team leads).
- **Goals**: LC + member target attainment table; **Set goals** modal —
  cadence + period pickers, per-metric inputs (outreaches/meetings/contracts/revenue €);
  target gets a notification.
- **Reports**: month-range filter, KPI cards, **Bottlenecks** (biggest drop-off,
  most-stuck stage, inactive 21d+, overdue), pie by stage, outreaches histogram,
  conversion bars, CSV export.
- **Performance**: member filter; LCVP goal progress = own + team (goalContributorIds).

## Admin (MCVP) — /admin/*
- **Global Dashboard**: LC filter, meeting drill-down, KPIs, funnel, adjacent +
  milestone conversions, revenue timeline, goal progress, **LC + member rankings
  with selectable criteria** (outreaches/meetings/signed/conversion/revenue),
  **Reset data** (two-step confirm; clears sales, keeps users/LCs).
- **LC Management**: LC cards + LCVP goal setting.
- **User Management**: search/LC/role filters, inline role/LC/active editing,
  pagination, per-user pipeline view.
- **Approvals**: pending sign-ups → approve/decline; recently-decided list.
- **Analytics**: cross-LC comparison, channel mix, duplicates panel, trend.
- **Settings**: data summary, reset-to-seed, audit trail (actor name + LC).
- Admin edits **all** pipelines (canEditOwned).

## Cross-cutting
- **Notifications** (bell): meeting/contract/revenue/goal/account kinds, unread
  badge, mark-all-read, click → navigate + highlight lead; derived reminders
  (overdue / upcoming meeting / inactive).
- **Realtime** (Supabase mode): all tables stream to all clients, RLS-scoped.
- **Branding**: gem.png mark + favicon; login bg.png fade; "Made with 🩵 by
  Aboulkacem" + LinkedIn everywhere (`ui/Brand.tsx`).

## Added 2026-07-06
Contract records auto-maintained by stage moves (dateSent on "Contract sent",
dateSigned + daysUntilSigned on "Contract signed"); **Payment expected** date on
leads + receivables-by-month schedule in Credit & revenue; delete opportunity
(danger zone in lead detail) and delete contact (CompanyDialog); approval
notification to the new user; scoped RLS live (see CLAUDE.md security_state).

## Known gaps (tracked in MEMORY.md)
Company delete/edit UI; images bucket unused (assets bundled); mock sign-in
checks no password (demo mode only).
