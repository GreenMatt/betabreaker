-- Site admins and admin RPCs for badges and challenges

create table if not exists public.site_admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.site_admins enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='site_admins' and policyname='site admins readable') then
    create policy "site admins readable" on public.site_admins for select using (true);
  end if;
end $$;

create or replace function public.is_site_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;

-- Badge admin RPCs
-- Drop old signature if present
drop function if exists public.admin_upsert_badge(uuid, text, text, jsonb, text);

create or replace function public.admin_upsert_badge(
  p_name text,
  p_id uuid default null,
  p_description text default null,
  p_criteria jsonb default '{}'::jsonb,
  p_icon text default null
)
returns public.badges
language plpgsql security definer set search_path = public as $$
declare result public.badges;
begin
  if not public.is_site_admin() then
    raise exception 'not authorized';
  end if;
  if p_id is null then
    insert into public.badges(id, name, description, criteria, icon)
    values (gen_random_uuid(), p_name, p_description, p_criteria, p_icon)
    returning * into result;
  else
    update public.badges
      set name = p_name,
          description = p_description,
          criteria = coalesce(p_criteria, '{}'::jsonb),
          icon = p_icon
    where id = p_id
    returning * into result;
  end if;
  return result;
end;
$$;

create or replace function public.admin_delete_badge(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.badges where id = p_id;
  return true;
end;
$$;

-- Challenge admin RPCs
-- Drop old signature if present
drop function if exists public.admin_upsert_challenge(uuid, text, text, date, date, jsonb, uuid);

create or replace function public.admin_upsert_challenge(
  p_title text,
  p_start date,
  p_end date,
  p_id uuid default null,
  p_description text default null,
  p_criteria jsonb default '{}'::jsonb,
  p_gym_id uuid default null
)
returns public.challenges
language plpgsql security definer set search_path = public as $$
declare ok boolean := false; result public.challenges;
begin
  if p_gym_id is null then
    ok := public.is_site_admin();
  else
    ok := public.is_gym_admin(p_gym_id);
  end if;
  if not ok then raise exception 'not authorized'; end if;

  if p_id is null then
    insert into public.challenges(id, title, description, start_date, end_date, criteria, gym_id)
    values (gen_random_uuid(), p_title, p_description, p_start, p_end, p_criteria, p_gym_id)
    returning * into result;
  else
    update public.challenges
      set title = p_title,
          description = p_description,
          start_date = p_start,
          end_date = p_end,
          criteria = coalesce(p_criteria, '{}'::jsonb),
          gym_id = p_gym_id
    where id = p_id
    returning * into result;
  end if;
  return result;
end;
$$;

create or replace function public.admin_delete_challenge(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare gid uuid; ok boolean;
begin
  select gym_id into gid from public.challenges where id = p_id;
  if gid is null then
    ok := public.is_site_admin();
  else
    ok := public.is_gym_admin(gid);
  end if;
  if not ok then raise exception 'not authorized'; end if;
  delete from public.challenges where id = p_id;
  return true;
end;
$$;

grant execute on function public.is_site_admin() to authenticated;
grant execute on function public.admin_upsert_badge(text, uuid, text, jsonb, text) to authenticated;
grant execute on function public.admin_delete_badge(uuid) to authenticated;
grant execute on function public.admin_upsert_challenge(text, date, date, uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.admin_delete_challenge(uuid) to authenticated;
