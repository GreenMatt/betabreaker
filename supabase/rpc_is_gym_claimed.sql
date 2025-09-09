-- Simple helper to check if a gym has any admins
create or replace function public.is_gym_claimed(gid uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.gym_admins ga where ga.gym_id = gid);
$$;

grant execute on function public.is_gym_claimed(uuid) to anon, authenticated;

