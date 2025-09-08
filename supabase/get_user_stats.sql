-- Per-user stats for the signed-in user
-- Ensure re-runs work even if the return signature changed
drop function if exists public.get_user_stats();

create or replace function public.get_user_stats()
returns table (
  climb_count integer,
  highest_grade smallint,
  badge_count integer,
  fa_count integer
) language sql security definer set search_path = public as $$
  with ranked as (
    select climb_id, user_id,
           row_number() over (partition by climb_id order by date asc, user_id asc) as rn
    from public.climb_logs
    where attempt_type in ('flashed','sent')
  )
  select
    (select count(*)::int from public.climb_logs where user_id = auth.uid()) as climb_count,
    (select coalesce(max(c.grade), 0)::smallint from public.climb_logs l join public.climbs c on c.id = l.climb_id where l.user_id = auth.uid()) as highest_grade,
    (select count(*)::int from public.user_badges where user_id = auth.uid()) as badge_count,
    (select count(*)::int from ranked where rn = 1 and user_id = auth.uid()) as fa_count;
$$;

grant execute on function public.get_user_stats() to authenticated;
