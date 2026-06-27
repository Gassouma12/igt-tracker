-- ============================================================================
-- iGT Sales Platform — Postgres schema for Supabase
-- ============================================================================
-- Run this in the Supabase SQL editor (or `supabase db push`) to create the
-- database. Column names are QUOTED camelCase so they match the app's
-- TypeScript entities 1:1 (src/data/types.ts) — no field renaming needed.
--
-- Enums are modelled as TEXT + CHECK constraints (simple to evolve; matches the
-- string-union types in the app). Foreign keys are plain text ids.
-- ============================================================================

-- ---- local committees ------------------------------------------------------
create table if not exists local_committees (
  id          text primary key,
  name        text not null,
  country     text not null default 'Belgium',
  "lcpId"     text,
  "lcvpIds"   text[] not null default '{}'
);

-- ---- users -----------------------------------------------------------------
create table if not exists users (
  id           text primary key,
  name         text not null,
  email        text not null unique,
  role         text not null default 'member' check (role in ('admin','lcp','lcvp','member')),
  "lcId"       text references local_committees(id) on delete set null,
  position     text not null default 'Member',
  "teamLeadId" text references users(id) on delete set null,
  active       boolean not null default true,
  phone        text,
  status       text not null default 'approved' check (status in ('pending','approved','rejected'))
);

-- ---- companies -------------------------------------------------------------
create table if not exists companies (
  id        text primary key,
  name      text not null,
  industry  text,
  country   text,
  website   text,
  linkedin  text,
  notes     text
);

-- ---- contacts --------------------------------------------------------------
create table if not exists contacts (
  id          text primary key,
  "companyId" text not null references companies(id) on delete cascade,
  name        text not null,
  role        text,
  email       text,
  phone       text,
  linkedin    text
);

-- ---- opportunities ---------------------------------------------------------
create table if not exists opportunities (
  id                text primary key,
  "companyId"       text not null references companies(id) on delete cascade,
  "contactId"       text references contacts(id) on delete set null,
  "ownerId"         text not null references users(id) on delete cascade,
  "lcId"            text references local_committees(id) on delete set null,
  status            text not null default 'Prospect' check (status in (
                      'Prospect','Contacted','Follow-up','Meeting scheduled',
                      'Negotiation','Contract sent','Contract signed','Lost')),
  value             numeric not null default 0,
  "revenueReceived" boolean not null default false,
  "nextAction"      text,
  "nextActionDate"  date,
  "lastActivityAt"  date,
  "createdAt"       date,
  "updatedAt"       timestamptz
);
create index if not exists opportunities_owner_idx on opportunities("ownerId");
create index if not exists opportunities_lc_idx    on opportunities("lcId");
create index if not exists opportunities_company_idx on opportunities("companyId");

-- ---- activities (one row per outreach touch) -------------------------------
create table if not exists activities (
  id              text primary key,
  "opportunityId" text not null references opportunities(id) on delete cascade,
  "ownerId"       text not null references users(id) on delete cascade,
  type            text not null check (type in ('LinkedIn','Email','Cold call','Follow-up','Meeting')),
  phase           text not null check (phase in ('first','follow-up','meeting')),
  count           integer not null default 1,
  outcome         text not null default 'neutral' check (outcome in ('positive','neutral','no-response')),
  date            date,
  notes           text
);
create index if not exists activities_opp_idx on activities("opportunityId");

-- ---- meetings --------------------------------------------------------------
create table if not exists meetings (
  id              text primary key,
  "opportunityId" text not null references opportunities(id) on delete cascade,
  "ownerId"       text not null references users(id) on delete cascade,
  date            date,
  number          integer not null default 1,
  outcome         text,
  "nextAction"    text,
  notes           text
);
create index if not exists meetings_opp_idx on meetings("opportunityId");

-- ---- contracts -------------------------------------------------------------
create table if not exists contracts (
  id                text primary key,
  "opportunityId"   text not null references opportunities(id) on delete cascade,
  "dateSent"        date,
  "dateSigned"      date,
  "daysUntilSigned" integer
);

-- ---- goals -----------------------------------------------------------------
create table if not exists goals (
  id        text primary key,
  scope     text not null check (scope in ('member','lc','global')),
  "ownerId" text references users(id) on delete cascade,
  "lcId"    text references local_committees(id) on delete cascade,
  period    text not null,                       -- '2026-S1' | '2026-06' | '2026-W26'
  cadence   text not null default 'semester' check (cadence in ('weekly','monthly','semester')),
  metric    text not null check (metric in ('outreaches','meetings','contracts','revenue')),
  planned   numeric not null default 0
);
-- one target per owner/metric/cadence/period (no collision across cadences)
create unique index if not exists goals_unique_member_idx
  on goals("ownerId", metric, cadence, period) where scope = 'member';

-- ---- activity log (audit trail) --------------------------------------------
create table if not exists activity_log (
  id        text primary key,
  "actorId" text not null references users(id) on delete cascade,
  entity    text not null,
  "entityId" text not null,
  action    text not null,
  "from"    text,
  "to"      text,
  at        timestamptz not null default now()
);

-- ---- notifications ---------------------------------------------------------
create table if not exists notifications (
  id              text primary key,
  "recipientId"   text not null references users(id) on delete cascade,
  "actorId"       text not null references users(id) on delete cascade,
  "opportunityId" text references opportunities(id) on delete cascade, -- null for goal/account
  kind            text not null check (kind in ('meeting','contract','goal','revenue')),
  message         text not null,
  read            boolean not null default false,
  at              timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on notifications("recipientId");

-- ============================================================================
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Mirror src/lib/rbac.ts. Start permissive (any authenticated user) so the app
-- works end-to-end, then tighten. The commented policy shows the target shape
-- for opportunities (member: own; lcvp: team+LC; lcp: LC; admin: all).
-- ============================================================================
alter table users             enable row level security;
alter table local_committees  enable row level security;
alter table companies         enable row level security;
alter table contacts          enable row level security;
alter table opportunities     enable row level security;
alter table activities        enable row level security;
alter table meetings          enable row level security;
alter table contracts         enable row level security;
alter table goals             enable row level security;
alter table activity_log      enable row level security;
alter table notifications     enable row level security;

-- Permissive starter policies — every authenticated user can read/write.
do $$
declare t text;
begin
  foreach t in array array['users','local_committees','companies','contacts',
    'opportunities','activities','meetings','contracts','goals','activity_log','notifications']
  loop
    execute format('drop policy if exists %I_auth_all on %I;', t, t);
    execute format(
      'create policy %I_auth_all on %I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;

-- Example of a tighter scope (enable once users.id maps to auth.uid()):
-- create policy opportunities_scoped on opportunities for select to authenticated
--   using (
--     "ownerId" = auth.uid()::text
--     or exists (select 1 from users me where me.id = auth.uid()::text
--                and (me.role = 'admin'
--                     or (me.role in ('lcp','lcvp') and me."lcId" = opportunities."lcId")))
--   );
