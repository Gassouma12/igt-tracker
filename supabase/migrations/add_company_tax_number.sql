-- Adds the company tax / VAT number. Run once in the Supabase SQL editor
-- (Dashboard → SQL) or via the session pooler. Safe to re-run.
alter table companies add column if not exists "taxNumber" text;
