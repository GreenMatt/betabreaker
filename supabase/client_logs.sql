-- Client-side error logs for diagnostics

create table if not exists public.client_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  level text not null check (level in ('error','warn','info')) default 'error',
  message text not null,
  stack text,
  url text,
  ua text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.client_logs enable row level security;

-- Allow anyone to insert logs (even signed out). Do not allow selects by default.
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='client_logs' and policyname='client logs insert open'
  ) then
    create policy "client logs insert open" on public.client_logs for insert with check (true);
  end if;
end $$;

create index if not exists idx_client_logs_created on public.client_logs(created_at);

