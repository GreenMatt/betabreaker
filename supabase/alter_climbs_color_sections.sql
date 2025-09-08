-- Add color and dyno to climbs; add gym_sections and link climbs to sections

-- Colors: allow null or one of the set; store as lowercase
alter table public.climbs add column if not exists color text;
alter table public.climbs add column if not exists dyno boolean default false;

-- Add constraint for allowed colors (idempotent approach: drop then add)
do $$ begin
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'climbs_color_allowed') then
    alter table public.climbs drop constraint climbs_color_allowed;
  end if;
end $$;
alter table public.climbs add constraint climbs_color_allowed check (
  color is null or lower(color) in ('black','yellow','pink','teal','blue','purple','red','green')
);

-- Sections per gym
create table if not exists public.gym_sections (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (gym_id, name)
);

-- Link climbs to section (optional)
alter table public.climbs add column if not exists section_id uuid references public.gym_sections(id) on delete set null;

-- RLS
alter table public.gym_sections enable row level security;
do $$ begin
  -- readable by all
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='gym_sections' and policyname='sections readable'
  ) then
    create policy "sections readable" on public.gym_sections for select using (true);
  end if;
  -- admins manage
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='gym_sections' and policyname='sections admin manage'
  ) then
    create policy "sections admin manage" on public.gym_sections for all using (is_gym_admin(gym_id));
  end if;
end $$;

