-- ============================================================================
-- request_account() — resilient self-service signup (fixes: a re-registered
-- account, after the previous one was deleted, produced no admin approval
-- request). Run once in the Supabase SQL editor (needs owner privileges).
--
-- The client (src/data/actions.ts signUp) calls this AFTER creating/authing the
-- Supabase Auth user, so auth.uid() is the caller. SECURITY DEFINER lets it:
--   1. reclaim a stale profile row left behind with the same email (only when it
--      owns no data — otherwise it raises, so nobody's leads are silently lost);
--   2. (re)create the caller's own pending profile keyed on auth.uid().
-- The existing trg_notify_admins_on_signup trigger then notifies every admin.
--
-- Until this is applied the client falls back to a plain insert, so signup keeps
-- working — this migration only ADDS the reclaim + reliable-notify behaviour.
-- ============================================================================

create or replace function public.request_account(
  p_name     text,
  p_email    text,
  p_phone    text default null,
  p_position text default null,
  p_lc       text default null,
  p_role     text default 'member'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   text := auth.uid()::text;
  v_email text := lower(trim(p_email));
  v_stale record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('member','team_leader','lcvp','lcp') then
    raise exception 'Invalid role %', p_role;
  end if;

  -- Reclaim a stale profile with the same email but a different id (left over
  -- when a previous auth user was deleted). Refuse if it still owns data.
  for v_stale in
    select id from users where lower(email) = v_email and id <> v_uid
  loop
    if exists (select 1 from opportunities where "ownerId" = v_stale.id)
       or exists (select 1 from activities where "ownerId" = v_stale.id)
       or exists (select 1 from meetings where "ownerId" = v_stale.id) then
      raise exception
        'An account with this email already has data. Ask an MCVP to reassign or remove it first.'
        using errcode = 'unique_violation';
    end if;
    delete from users where id = v_stale.id;
  end loop;

  -- (Re)create the caller's own pending profile. If they already have a profile
  -- (e.g. an approved returning user), leave it untouched.
  insert into users (id, name, email, role, "lcId", position, "teamLeadId", active, phone, status)
  values (v_uid, trim(p_name), v_email, p_role, p_lc,
          coalesce(nullif(trim(p_position), ''), 'Member'), null, true,
          nullif(trim(coalesce(p_phone, '')), ''), 'pending')
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.request_account(text, text, text, text, text, text) from public, anon;
grant execute on function public.request_account(text, text, text, text, text, text) to authenticated;
