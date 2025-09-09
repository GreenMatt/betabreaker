-- Training log support: align activity types and add RLS policies

-- Update allowed activity types on training_sessions to: Climb, Board, Hang, Strength, Cardio, Yoga
do $$
declare cname text;
begin
  -- Drop existing check constraint on activity_type (find by def text)
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.training_sessions'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%activity_type%in%';
  if cname is not null then
    execute format('alter table public.training_sessions drop constraint %I', cname);
  end if;
  -- Add new constraint
  alter table public.training_sessions
    add constraint training_sessions_activity_type_check
    check (
      activity_type in (
        'Climb','Board','Hang','Strength','Cardio','Yoga',
        'Boulder','Top Rope','Lead','Strength Training','Other'
      )
    );
end $$;

-- Index to accelerate user+date queries
create index if not exists idx_training_sessions_user_date on public.training_sessions(user_id, date);

-- RLS policies: owner-only access
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='training_sessions' and policyname='training select own'
  ) then
    create policy "training select own" on public.training_sessions
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='training_sessions' and policyname='training insert own'
  ) then
    create policy "training insert own" on public.training_sessions
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='training_sessions' and policyname='training modify own'
  ) then
    create policy "training modify own" on public.training_sessions
      for update using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='training_sessions' and policyname='training delete own'
  ) then
    create policy "training delete own" on public.training_sessions
      for delete using (user_id = auth.uid());
  end if;
end $$;
