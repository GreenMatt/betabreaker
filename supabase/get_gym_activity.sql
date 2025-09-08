-- Gym activity feed: recent logs for a gym's climbs
-- Respects user privacy: includes only logs from users with private_profile = false or self
drop function if exists public.get_gym_activity(uuid, int, int);
create or replace function public.get_gym_activity(
  gid uuid,
  page_size int default 20,
  page int default 0
)
returns table (
  id uuid,
  created_at timestamptz,
  attempt_type text,
  attempts smallint,
  personal_rating smallint,
  notes text,
  user_id uuid,
  user_name text,
  profile_photo text,
  climb_id uuid,
  climb_name text,
  gym_name text,
  grade smallint,
  type text,
  color text,
  bump_count integer,
  bumped boolean,
  comments jsonb
)
language sql
security definer
set search_path = public
as $$
  select l.id,
         l.date as created_at,
         l.attempt_type,
         l.attempts,
         l.personal_rating,
         l.notes,
         l.user_id,
         u.name as user_name,
         u.profile_photo,
         l.climb_id,
         c.name as climb_name,
         g.name as gym_name,
         c.grade,
         c.type,
         c.color,
         coalesce(bc.cnt, 0) as bump_count,
         (bu.id is not null) as bumped,
         coalesce(cm.comments, '[]'::jsonb) as comments
  from public.climb_logs l
  join public.climbs c on c.id = l.climb_id and c.gym_id = gid
  join public.gyms g on g.id = c.gym_id
  left join public.users u on u.id = l.user_id
  left join lateral (
    select count(*)::int as cnt from public.bumps b where b.log_id = l.id
  ) bc on true
  left join public.bumps bu on bu.log_id = l.id and bu.user_id = auth.uid()
  left join lateral (
    select jsonb_agg(jsonb_build_object(
             'user_id', x.user_id,
             'user_name', x.user_name,
             'profile_photo', x.profile_photo,
             'comment', x.comment,
             'created_at', x.created_at
           ) order by x.created_at desc) as comments
    from (
      select b.user_id, u2.name as user_name, u2.profile_photo, b.comment, b.created_at
      from public.bumps b
      left join public.users u2 on u2.id = b.user_id
      where b.log_id = l.id and b.comment is not null
      order by b.created_at desc
      limit 2
    ) x
  ) cm on true
  where (u.private_profile is distinct from true) or l.user_id = auth.uid()
  order by l.date desc
  limit page_size offset page * page_size;
$$;

grant execute on function public.get_gym_activity(uuid, int, int) to authenticated;
