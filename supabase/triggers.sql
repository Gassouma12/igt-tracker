-- Server-side triggers. Run after schema.sql + rls.sql on any fresh project.
--
-- notify_admins_on_signup: when a new pending profile is inserted, create an
-- approval notification for every admin. This lives server-side because the
-- signing-up client is unapproved and cannot read the admin list under RLS —
-- so the app can't target real admins from the browser. SECURITY DEFINER lets
-- the trigger insert notifications for any recipient, bypassing RLS.

create or replace function public.notify_admins_on_signup()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into notifications (id, "recipientId", "actorId", "opportunityId", kind, message, read, at)
    select 'ntf_' || substr(md5(random()::text || clock_timestamp()::text || a.id), 1, 20),
           a.id, new.id, null, 'goal',
           new.name || ' requested an account — approval needed', false, now()
    from users a
    where a.role = 'admin' and a.active = true and a.id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_on_signup on users;
create trigger trg_notify_admins_on_signup
  after insert on users
  for each row
  execute function public.notify_admins_on_signup();
