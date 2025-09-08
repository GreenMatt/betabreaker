-- Level badges (1-10) and auto-award mechanism on climb log insert

-- Pre-flight: ensure core tables exist. If not, instruct to run schema.sql first.
do $$ begin
  if to_regclass('public.badges') is null
     or to_regclass('public.user_badges') is null
     or to_regclass('public.climb_logs') is null
     or to_regclass('public.climbs') is null then
    raise exception 'Core tables missing. Run supabase/schema.sql first to create badges, user_badges, climbs, and climb_logs.';
  end if;
end $$;

-- 1) Seed badges Level 1 .. Level 10 (idempotent by name)
insert into public.badges (name, description, criteria, icon)
select v.name, v.description, v.criteria::jsonb, v.icon
from (
  values
    ('Level 1',  'Logged a level 1 climb',  '{"type":"level","level":1}',  null),
    ('Level 2',  'Logged a level 2 climb',  '{"type":"level","level":2}',  null),
    ('Level 3',  'Logged a level 3 climb',  '{"type":"level","level":3}',  null),
    ('Level 4',  'Logged a level 4 climb',  '{"type":"level","level":4}',  null),
    ('Level 5',  'Logged a level 5 climb',  '{"type":"level","level":5}',  null),
    ('Level 6',  'Logged a level 6 climb',  '{"type":"level","level":6}',  null),
    ('Level 7',  'Logged a level 7 climb',  '{"type":"level","level":7}',  null),
    ('Level 8',  'Logged a level 8 climb',  '{"type":"level","level":8}',  null),
    ('Level 9',  'Logged a level 9 climb',  '{"type":"level","level":9}',  null),
    ('Level 10', 'Logged a level 10 climb', '{"type":"level","level":10}', null)
) as v(name, description, criteria, icon)
where not exists (select 1 from public.badges b where b.name = v.name);

-- 2) Award level badge when a new climb log is inserted
create or replace function public.award_level_badge_on_log()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_grade smallint;
  v_badge_id uuid;
begin
  -- Fetch climb grade
  select grade into v_grade from public.climbs where id = new.climb_id;
  if v_grade is null then
    return new;
  end if;

  -- Find matching "level" badge with the same level number
  select id into v_badge_id
  from public.badges
  where (criteria->>'type') = 'level'
    and (criteria->>'level')::int = v_grade
  limit 1;

  if v_badge_id is null then
    return new;
  end if;

  -- Insert if the user does not already have this badge
  insert into public.user_badges(user_id, badge_id)
  select new.user_id, v_badge_id
  where not exists (
    select 1 from public.user_badges ub where ub.user_id = new.user_id and ub.badge_id = v_badge_id
  );

  return new;
end;
$$;

-- Create trigger (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_award_level_badge_on_log'
  ) then
    create trigger trg_award_level_badge_on_log
    after insert on public.climb_logs
    for each row execute function public.award_level_badge_on_log();
  end if;
end $$;

-- 3) Helper to backfill level badges for a user (optional)
create or replace function public.backfill_level_badges_for_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_badge_id uuid;
begin
  for r in
    select distinct c.grade
    from public.climb_logs l
    join public.climbs c on c.id = l.climb_id
    where l.user_id = p_user_id and c.grade is not null
  loop
    select id into v_badge_id from public.badges
     where (criteria->>'type')='level' and (criteria->>'level')::int = r.grade
     limit 1;
    if v_badge_id is not null then
      insert into public.user_badges(user_id, badge_id)
      select p_user_id, v_badge_id
      where not exists (select 1 from public.user_badges ub where ub.user_id=p_user_id and ub.badge_id=v_badge_id);
    end if;
  end loop;
end;
$$;

grant execute on function public.backfill_level_badges_for_user(uuid) to authenticated;
