-- Returns recent climb logs from people the current user follows
-- If the function signature changed, drop the old one first
drop function if exists public.get_following_logs(int, int);
create or replace function public.get_following_logs(page_size int default 20, page int default 0)
returns table (
  id uuid,
  created_at timestamptz,
  attempt_type text,
  attempts smallint,
  personal_rating smallint,
  notes text,
  user_id uuid,
  climb_id uuid,
  climb_name text,
  gym_name text,
  grade smallint,
  type text,
  color text,
  user_name text,
  profile_photo text,
  bump_count integer,
  bumped boolean
) language sql security definer set search_path = public as $$
  select l.id, l.date as created_at, l.attempt_type, l.attempts, l.personal_rating, l.notes, l.user_id, l.climb_id,
         c.name as climb_name, g.name as gym_name, c.grade, c.type, c.color,
         u.name as user_name, u.profile_photo,
         coalesce(bc.cnt, 0) as bump_count,
         (bu.id is not null) as bumped
  from public.climb_logs l
  join public.follows f on f.following_id = l.user_id and f.follower_id = auth.uid()
  join public.climbs c on c.id = l.climb_id
  join public.gyms g on g.id = c.gym_id
  left join public.users u on u.id = l.user_id
  left join lateral (
    select count(*)::int as cnt from public.bumps b where b.log_id = l.id
  ) bc on true
  left join public.bumps bu on bu.log_id = l.id and bu.user_id = auth.uid()
  order by l.date desc
  limit page_size offset page * page_size
$$;

grant execute on function public.get_following_logs(int, int) to authenticated;
