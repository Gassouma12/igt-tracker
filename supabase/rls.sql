-- ============================================================================
-- Scoped RLS — replaces the permissive *_auth_all starter policies.
-- Mirrors src/lib/rbac.ts. Idempotent: drops old policies, recreates helpers.
-- Run AFTER schema.sql (SQL editor or scripts/setup-supabase.mjs style).
-- ============================================================================

-- ---- helpers (SECURITY DEFINER so querying `users` inside a `users` policy
-- ---- doesn't recurse into RLS) ---------------------------------------------
create or replace function public.uid() returns text
language sql stable as $$ select auth.uid()::text $$;

create or replace function public.me_role() returns text
language sql stable security definer set search_path = public as
$$ select role from users where id = auth.uid()::text $$;

create or replace function public.me_lc() returns text
language sql stable security definer set search_path = public as
$$ select "lcId" from users where id = auth.uid()::text $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where id = auth.uid()::text and role = 'admin' and status = 'approved') $$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where id = auth.uid()::text and status = 'approved' and active) $$;

-- ---- drop every existing policy on the app tables ---------------------------
do $do$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('users','local_committees','companies','contacts','opportunities',
                      'activities','meetings','contracts','goals','activity_log','notifications')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $do$;

-- ---- users -------------------------------------------------------------------
-- read: own row always (pending screen needs it); everything once approved
create policy users_select on users for select to authenticated
  using (id = public.uid() or public.is_approved());
-- signup: only your own row, only as pending, never as admin
create policy users_insert_self on users for insert to authenticated
  with check (id = public.uid() and status = 'pending' and role in ('member','team_leader','lcvp','lcp'));
-- admin manages everyone (create/provision profiles, incl. demo/mock members)
create policy users_admin_insert on users for insert to authenticated
  with check (public.is_admin());
create policy users_admin_update on users for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy users_admin_delete on users for delete to authenticated
  using (public.is_admin());
-- LCP/LCVP manage members of their own LC (team-lead assignment); the member
-- must stay a member of that LC — blocks role/LC escalation through this path.
-- ponytail: column-level control would need a trigger; row-level is the ceiling here.
create policy users_lc_leads_update on users for update to authenticated
  using (public.is_approved() and public.me_role() in ('lcp','lcvp')
         and role = 'member' and "lcId" = public.me_lc())
  with check (role = 'member' and "lcId" = public.me_lc());

-- ---- local_committees (public read: the signup form lists LCs pre-auth) -----
create policy lcs_select on local_committees for select to anon, authenticated using (true);
create policy lcs_admin_write on local_committees for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- companies & contacts (org-shared: duplicate detection is cross-LC) -----
create policy companies_select on companies for select to authenticated using (public.is_approved());
create policy companies_write on companies for insert to authenticated with check (public.is_approved());
create policy companies_update on companies for update to authenticated
  using (public.is_approved()) with check (public.is_approved());
create policy companies_delete on companies for delete to authenticated using (public.is_admin());

create policy contacts_select on contacts for select to authenticated using (public.is_approved());
create policy contacts_write on contacts for insert to authenticated with check (public.is_approved());
create policy contacts_update on contacts for update to authenticated
  using (public.is_approved()) with check (public.is_approved());
create policy contacts_delete on contacts for delete to authenticated using (public.is_approved());

-- ---- opportunities (the core rule: only the owner and the MCVP write) -------
create policy opps_select on opportunities for select to authenticated using (public.is_approved());
create policy opps_insert on opportunities for insert to authenticated
  with check (public.is_approved() and ("ownerId" = public.uid() or public.is_admin()));
create policy opps_update on opportunities for update to authenticated
  using (public.is_approved() and ("ownerId" = public.uid() or public.is_admin()))
  with check ("ownerId" = public.uid() or public.is_admin());
create policy opps_delete on opportunities for delete to authenticated
  using (public.is_approved() and ("ownerId" = public.uid() or public.is_admin()));

-- ---- activities & meetings (owner-scoped writes) -----------------------------
create policy acts_select on activities for select to authenticated using (public.is_approved());
create policy acts_insert on activities for insert to authenticated
  with check (public.is_approved() and ("ownerId" = public.uid() or public.is_admin()));
create policy acts_update on activities for update to authenticated
  using ("ownerId" = public.uid() or public.is_admin())
  with check ("ownerId" = public.uid() or public.is_admin());
create policy acts_delete on activities for delete to authenticated
  using ("ownerId" = public.uid() or public.is_admin());

create policy mtgs_select on meetings for select to authenticated using (public.is_approved());
create policy mtgs_insert on meetings for insert to authenticated
  with check (public.is_approved() and ("ownerId" = public.uid() or public.is_admin()));
create policy mtgs_update on meetings for update to authenticated
  using ("ownerId" = public.uid() or public.is_admin())
  with check ("ownerId" = public.uid() or public.is_admin());
create policy mtgs_delete on meetings for delete to authenticated
  using ("ownerId" = public.uid() or public.is_admin());

-- ---- contracts (writable by the opportunity's owner or admin) ----------------
create policy contracts_select on contracts for select to authenticated using (public.is_approved());
create policy contracts_write on contracts for all to authenticated
  using (public.is_approved() and exists (
    select 1 from opportunities o where o.id = "opportunityId"
      and (o."ownerId" = public.uid() or public.is_admin())))
  with check (public.is_approved() and exists (
    select 1 from opportunities o where o.id = "opportunityId"
      and (o."ownerId" = public.uid() or public.is_admin())));

-- ---- goals (rbac.canSetGoalFor: admin→lcvp, lcvp→team_leader, tl→member) -----
create policy goals_select on goals for select to authenticated using (public.is_approved());
create policy goals_write on goals for all to authenticated
  using (public.is_admin() or (public.is_approved() and exists (
    select 1 from users t where t.id = goals."ownerId" and (
      (public.me_role() = 'lcvp' and t.role = 'team_leader' and t."lcId" = public.me_lc())
      or (public.me_role() = 'team_leader' and t.role = 'member' and t."teamLeadId" = public.uid())))))
  with check (public.is_admin() or (public.is_approved() and exists (
    select 1 from users t where t.id = goals."ownerId" and (
      (public.me_role() = 'lcvp' and t.role = 'team_leader' and t."lcId" = public.me_lc())
      or (public.me_role() = 'team_leader' and t.role = 'member' and t."teamLeadId" = public.uid())))));

-- ---- activity_log (write your own trail; only admin reads it) ----------------
create policy log_select on activity_log for select to authenticated using (public.is_admin());
create policy log_insert on activity_log for insert to authenticated
  with check ("actorId" = public.uid());
create policy log_delete on activity_log for delete to authenticated using (public.is_admin());

-- ---- notifications (recipient-private; any authed user may send AS themselves;
-- ---- pending users included so "account requested" reaches the admins) -------
create policy ntf_select on notifications for select to authenticated
  using ("recipientId" = public.uid());
create policy ntf_insert on notifications for insert to authenticated
  with check ("actorId" = public.uid());
create policy ntf_update on notifications for update to authenticated
  using ("recipientId" = public.uid()) with check ("recipientId" = public.uid());
create policy ntf_delete on notifications for delete to authenticated
  using ("recipientId" = public.uid() or public.is_admin());
