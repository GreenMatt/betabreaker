-- Seed core data for BetaBreaker
-- Usage:
-- 1) Replace YOUR_EMAIL@example.com below with your Supabase auth email.
-- 2) Run the whole script in the Supabase SQL editor (or CLI).

-- Create default gym if not exists and get its id
with gym_row as (
  insert into public.gyms (name, location)
  select 'BetaBreaker HQ', 'Everywhere'
  where not exists (select 1 from public.gyms where name = 'BetaBreaker HQ')
  returning id
)
select 1;

-- Resolve gym id into a temp table for reuse
drop table if exists tmp_seed_gym_id;
create temporary table tmp_seed_gym_id as
select id as gym_id from public.gyms where name = 'BetaBreaker HQ';

-- Seed climbs (idempotent by name+gym)
insert into public.climbs (gym_id, name, grade, type, setter, location)
select t.gym_id, v.name, v.grade, v.type, v.setter, v.location
from tmp_seed_gym_id t
join (values
  ('Blue Arete', 5, 'boulder', 'Alex', 'Front Wall'),
  ('Red Slab',   3, 'top_rope', 'Sam',  'Slab Bay'),
  ('Gold Roof',  8, 'lead',     'Kai',  'Roof Cave')
) as v(name, grade, type, setter, location) on true
where not exists (
  select 1 from public.climbs c
  where c.gym_id = t.gym_id and c.name = v.name
);

-- Seed default sections for BetaBreaker HQ
insert into public.gym_sections (gym_id, name)
select t.gym_id, s.name from tmp_seed_gym_id t
join (values ('Front Wall'),('Slab Bay'),('Roof Cave')) as s(name) on true
on conflict do nothing;

-- Seed badges (idempotent by name)
insert into public.badges (name, description, criteria, icon)
select v.name, v.description, v.criteria::jsonb, v.icon
from (values
  ('First Send', 'Log your first climb', '{"type":"first_send"}', null),
  ('Endurance',  'Climb 10 routes in a week', '{"type":"weekly","count":10}', null)
) as v(name, description, criteria, icon)
where not exists (select 1 from public.badges b where b.name = v.name);

-- Seed a starter challenge (idempotent by title)
insert into public.challenges (title, description, start_date, end_date, criteria, gym_id)
select 'Opening Week Sprint', 'Rack up as many points as you can!', current_date, current_date + interval '14 days', '{"points":true}'::jsonb, t.gym_id
from tmp_seed_gym_id t
where not exists (select 1 from public.challenges c where c.title = 'Opening Week Sprint');

-- Make you an admin of the gym (BY EMAIL). Replace the email below.
insert into public.gym_admins (gym_id, user_id)
select t.gym_id, u.id
from tmp_seed_gym_id t
join auth.users u on u.email = 'YOUR_EMAIL@example.com'
on conflict do nothing;

-- Cleanup temp table
drop table if exists tmp_seed_gym_id;

-- Done
select 'Seed complete' as status;
