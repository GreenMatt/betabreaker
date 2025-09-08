-- Add attempts count to climb_logs for 'sent' entries
alter table public.climb_logs add column if not exists attempts smallint check (attempts is null or attempts >= 1);

