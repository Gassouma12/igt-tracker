-- Enable realtime: add the app tables to the supabase_realtime publication.
-- Run once after schema.sql + seed.sql, in the Supabase SQL editor.
-- (Run on a fresh project. If a table is already published, that one line errors
--  with "already member of publication" — harmless, just skip it.)

alter publication supabase_realtime add table users;
alter publication supabase_realtime add table local_committees;
alter publication supabase_realtime add table companies;
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table opportunities;
alter publication supabase_realtime add table activities;
alter publication supabase_realtime add table meetings;
alter publication supabase_realtime add table contracts;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table activity_log;
alter publication supabase_realtime add table notifications;

-- Realtime respects RLS: a client only receives changes to rows it can SELECT.
