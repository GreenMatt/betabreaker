-- Reactions: Fist bumps on climb logs
create table if not exists public.bumps (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.climb_logs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  comment text,
  created_at timestamptz default now(),
  unique (log_id, user_id)
);

alter table public.bumps enable row level security;

-- Readable by all
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='bumps' and policyname='bumps readable'
  ) then
    create policy "bumps readable" on public.bumps for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='bumps' and policyname='bumps own write'
  ) then
    create policy "bumps own write" on public.bumps for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

create index if not exists idx_bumps_log on public.bumps(log_id);

