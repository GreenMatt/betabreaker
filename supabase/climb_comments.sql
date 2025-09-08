-- Threaded comments for climbs + setter notes
create table if not exists public.climb_comments (
  id uuid primary key default gen_random_uuid(),
  climb_id uuid not null references public.climbs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.climb_comments(id) on delete cascade,
  body text not null,
  is_setter boolean default false,
  created_at timestamptz default now()
);

alter table public.climb_comments enable row level security;

-- Readable by everyone
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='climb_comments' and policyname='climb comments readable'
  ) then
    create policy "climb comments readable" on public.climb_comments for select using (true);
  end if;
end $$;

-- Inserts: any authenticated can comment; setter notes only if gym admin of the climb's gym
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='climb_comments' and policyname='climb comments insert'
  ) then
    create policy "climb comments insert" on public.climb_comments for insert to authenticated with check (
      user_id = auth.uid() and (
        is_setter = false or exists (
          select 1 from public.climbs c where c.id = climb_id and public.is_gym_admin(c.gym_id)
        )
      )
    );
  end if;
end $$;

-- Updates/deletes: owner or gym admin
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='climb_comments' and policyname='climb comments modify'
  ) then
    create policy "climb comments modify" on public.climb_comments for all to authenticated using (
      user_id = auth.uid() or exists (
        select 1 from public.climbs c where c.id = climb_id and public.is_gym_admin(c.gym_id)
      )
    );
  end if;
end $$;

