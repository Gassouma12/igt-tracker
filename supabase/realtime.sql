-- Stream row changes to connected clients (realtime). Run once after schema.sql.
-- Adds every app table to the `supabase_realtime` publication; safe to re-run.
do $$
declare t text;
begin
  foreach t in array array['users','local_committees','companies','contacts',
    'opportunities','activities','meetings','contracts','goals','activity_log','notifications']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; -- already in the publication
    end;
  end loop;
end $$;

-- Realtime respects RLS: a client only receives changes to rows it could SELECT.
-- The permissive starter policies (schema.sql) let any authenticated user receive
-- all changes — tighten alongside the SELECT policies when you scope RLS.
