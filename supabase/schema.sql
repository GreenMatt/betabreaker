-- BetaBreaker initial schema
-- Requires: pgcrypto extension for gen_random_uuid
create extension if not exists pgcrypto;



-- Users profile table mirrors auth.users id
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  bio text,
  profile_photo text,
  experience_level smallint check (experience_level between 1 and 10),
  gym_affiliation uuid,
  private_profile boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.gym_admins (
  gym_id uuid references public.gyms(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  primary key (gym_id, user_id)
);

create table if not exists public.climbs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  grade smallint check (grade between 1 and 10),
  type text not null check (type in ('boulder','top_rope','lead')),
  setter text,
  date_added date default now(),
  active_status boolean default true,
  location text,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.climb_photos (
  id uuid primary key default gen_random_uuid(),
  climb_id uuid not null references public.climbs(id) on delete cascade,
  url text not null,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date timestamptz default now(),
  duration_mins int check (duration_mins >= 0),
  activity_type text not null check (activity_type in ('Boulder','Top Rope','Lead','Strength Training','Cardio','Yoga','Other')),
  notes text
);

create table if not exists public.climb_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  climb_id uuid not null references public.climbs(id) on delete cascade,
  date timestamptz default now(),
  attempt_type text not null check (attempt_type in ('flashed','sent','projected')),
  personal_rating smallint check (personal_rating between 1 and 10),
  notes text,
  session_id uuid references public.training_sessions(id) on delete set null
);

create table if not exists public.community_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  climb_id uuid not null references public.climbs(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  weight_factor numeric not null default 1,
  created_at timestamptz default now(),
  unique (user_id, climb_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb,
  icon text
);

create table if not exists public.user_badges (
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_date timestamptz default now(),
  created_at timestamptz default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  criteria jsonb not null default '{}'::jsonb,
  gym_id uuid references public.gyms(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.challenge_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  progress numeric not null default 0,
  completed boolean not null default false,
  updated_at timestamptz default now(),
  primary key (user_id, challenge_id)
);

-- Helpers
create or replace function public.is_gym_admin(gid uuid)
returns boolean security definer language sql as $$
  select exists (
    select 1 from public.gym_admins ga
    where ga.gym_id = gid and ga.user_id = auth.uid()
  );
$$;

-- RLS
alter table public.users enable row level security;
alter table public.gyms enable row level security;
alter table public.gym_admins enable row level security;
alter table public.climbs enable row level security;
alter table public.climb_photos enable row level security;
alter table public.training_sessions enable row level security;
alter table public.climb_logs enable row level security;
alter table public.community_ratings enable row level security;
alter table public.follows enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_progress enable row level security;

-- Users policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='profiles are viewable by all unless private or owner') then
    create policy "profiles are viewable by all unless private or owner" on public.users
      for select using (not private_profile or id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users can update own profile') then
    create policy "users can update own profile" on public.users
      for update using (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='insert own profile') then
    create policy "insert own profile" on public.users
      for insert with check (id = auth.uid());
  end if;
end $$;

-- Gyms
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gyms' and policyname='gyms readable to all') then
    create policy "gyms readable to all" on public.gyms for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gyms' and policyname='gyms admin manage') then
    create policy "gyms admin manage" on public.gyms for all using (is_gym_admin(id));
  end if;
end $$;

-- Gym admins
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gym_admins' and policyname='admins readable') then
    create policy "admins readable" on public.gym_admins for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gym_admins' and policyname='only admins can modify admin list') then
    create policy "only admins can modify admin list" on public.gym_admins for all using (EXISTS (SELECT 1 FROM public.gym_admins existing WHERE existing.gym_id = gym_admins.gym_id AND existing.user_id = auth.uid()) OR NOT EXISTS (SELECT 1 FROM public.gym_admins existing WHERE existing.gym_id = gym_admins.gym_id));
  end if;
end $$;

-- Climbs
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climbs' and policyname='climbs are public') then
    create policy "climbs are public" on public.climbs for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climbs' and policyname='gym admins manage climbs') then
    create policy "gym admins manage climbs" on public.climbs for all using (is_gym_admin(gym_id));
  end if;
end $$;

-- Climb photos
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climb_photos' and policyname='photos are public') then
    create policy "photos are public" on public.climb_photos for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climb_photos' and policyname='auth can add photos') then
    create policy "auth can add photos" on public.climb_photos for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climb_photos' and policyname='owner or admin can delete') then
    create policy "owner or admin can delete" on public.climb_photos for delete using (user_id = auth.uid() or exists (select 1 from public.climbs c where c.id = climb_id and is_gym_admin(c.gym_id)));
  end if;
end $$;

-- Sessions
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='training_sessions' and policyname='own sessions readable') then
    create policy "own sessions readable" on public.training_sessions for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='training_sessions' and policyname='own sessions writable') then
    create policy "own sessions writable" on public.training_sessions for all using (user_id = auth.uid());
  end if;
end $$;

-- Climb logs
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climb_logs' and policyname='own logs readable') then
    create policy "own logs readable" on public.climb_logs for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='climb_logs' and policyname='own logs writable') then
    create policy "own logs writable" on public.climb_logs for all using (user_id = auth.uid());
  end if;
end $$;

-- Ratings
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_ratings' and policyname='ratings readable') then
    create policy "ratings readable" on public.community_ratings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='community_ratings' and policyname='own rating upsert') then
    create policy "own rating upsert" on public.community_ratings for all using (user_id = auth.uid());
  end if;
end $$;

-- Follows
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='follows readable') then
    create policy "follows readable" on public.follows for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='create own follow') then
    create policy "create own follow" on public.follows for insert with check (follower_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='unfollow self') then
    create policy "unfollow self" on public.follows for delete using (follower_id = auth.uid());
  end if;
end $$;

-- Badges
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='badges' and policyname='badges readable') then
    create policy "badges readable" on public.badges for select using (true);
  end if;
end $$;
-- For now allow admins via RPC to manage badges; keep writes closed

-- User badges
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_badges' and policyname='user badges readable') then
    create policy "user badges readable" on public.user_badges for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_badges' and policyname='user can add own badges (temporary)') then
    create policy "user can add own badges (temporary)" on public.user_badges for insert with check (user_id = auth.uid());
  end if;
end $$;

-- Challenges
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenges' and policyname='challenges readable') then
    create policy "challenges readable" on public.challenges for select using (true);
  end if;
end $$;
-- Writes restricted to admins (via is_gym_admin) if gym-scoped; otherwise disabled

-- Challenge progress
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenge_progress' and policyname='own progress readable') then
    create policy "own progress readable" on public.challenge_progress for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenge_progress' and policyname='own progress upsert') then
    create policy "own progress upsert" on public.challenge_progress for all using (user_id = auth.uid());
  end if;
end $$;

-- Useful indexes
create index if not exists idx_climbs_gym on public.climbs(gym_id);
create index if not exists idx_logs_user on public.climb_logs(user_id);
create index if not exists idx_logs_climb on public.climb_logs(climb_id);
create index if not exists idx_ratings_climb on public.community_ratings(climb_id);
