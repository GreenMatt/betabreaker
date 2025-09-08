-- Allow first user to claim admin for a gym (only if no admins yet)
create or replace function public.claim_gym_admin(gid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare did boolean := false;
begin
  if not exists (select 1 from public.gym_admins where gym_id = gid) then
    insert into public.gym_admins (gym_id, user_id) values (gid, auth.uid());
    did := true;
  end if;
  return did;
end;
$$;

grant execute on function public.claim_gym_admin(uuid) to authenticated;

