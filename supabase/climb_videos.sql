-- Climb videos table and RLS policies
-- Requires: users, climbs tables

create table if not exists public.climb_videos (
  id uuid primary key default gen_random_uuid(),
  climb_id uuid not null references public.climbs(id) on delete cascade,
  url text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.climb_videos enable row level security;

-- Policies
do $$ begin
  -- Select: anyone can read videos
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'climb_videos' and policyname = 'climb_videos_select_all'
  ) then
    create policy climb_videos_select_all on public.climb_videos for select using (true);
  end if;

  -- Insert: authenticated users, must insert as themselves
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'climb_videos' and policyname = 'climb_videos_insert_self'
  ) then
    create policy climb_videos_insert_self on public.climb_videos
      for insert with check (auth.uid() = user_id);
  end if;

  -- Delete: owners can delete their own video
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'climb_videos' and policyname = 'climb_videos_delete_owner'
  ) then
    create policy climb_videos_delete_owner on public.climb_videos
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Optional: index for faster lookups by climb
create index if not exists climb_videos_by_climb on public.climb_videos(climb_id, created_at desc);

