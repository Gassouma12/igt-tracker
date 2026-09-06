-- ============================================================================
-- Performance indexes + data-retention helpers (data-management hardening).
-- Safe / non-destructive to apply. Run in the Supabase SQL editor.
-- The retention function only deletes when you call it (or schedule it).
-- ============================================================================

-- ---- indexes for the owner-scoped queries the app runs constantly -----------
create index if not exists activities_owner_idx  on activities("ownerId");
create index if not exists meetings_owner_idx    on meetings("ownerId");
create index if not exists goals_owner_idx        on goals("ownerId");
create index if not exists contracts_opp_idx      on contracts("opportunityId");
create index if not exists activity_log_at_idx    on activity_log(at);
create index if not exists activity_log_actor_idx on activity_log("actorId");
create index if not exists notifications_at_idx   on notifications(at);

-- ---- retention: keep the two unbounded tables from growing forever ----------
-- activity_log: audit trail — keep ~12 months. notifications: keep unread, plus
-- read ones from the last 90 days. Adjust the intervals to taste.
create or replace function public.prune_old_data(
  p_log_days int default 365,
  p_read_notif_days int default 90
) returns table(pruned_log bigint, pruned_notifications bigint)
language plpgsql
security definer
set search_path = public
as $$
declare v_log bigint; v_ntf bigint;
begin
  delete from activity_log where at < now() - make_interval(days => p_log_days);
  get diagnostics v_log = row_count;
  delete from notifications where read = true and at < now() - make_interval(days => p_read_notif_days);
  get diagnostics v_ntf = row_count;
  return query select v_log, v_ntf;
end;
$$;
revoke all on function public.prune_old_data(int, int) from public, anon, authenticated;

-- Run manually any time:   select * from public.prune_old_data();
-- Or schedule monthly with pg_cron (enable the extension first in Dashboard →
-- Database → Extensions), then:
--   select cron.schedule('prune-atom', '0 3 1 * *', $$ select public.prune_old_data(); $$);

-- ---- optional: cap stored notifications per recipient (keeps the newest 200) -
create or replace function public.cap_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from notifications
  where "recipientId" = new."recipientId"
    and id in (
      select id from notifications
      where "recipientId" = new."recipientId"
      order by at desc offset 200
    );
  return null;
end;
$$;
drop trigger if exists trg_cap_notifications on notifications;
create trigger trg_cap_notifications
  after insert on notifications
  for each row execute function public.cap_notifications();
